-- Personal OS initial schema
-- Run via: supabase db push  (or pasted into Supabase SQL editor)

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- entities: things you track (businesses, products, people, projects)
create table if not exists public.entities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  name        text not null,
  kind        text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- raw_captures: every voice/text capture, before classification
create table if not exists public.raw_captures (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  source          text not null,                -- 'telegram' | 'web' | 'ios-shortcut' | ...
  raw_text        text,
  audio_url       text,
  classification  jsonb,                        -- { kind, urgency, entity_id, tags, summary }
  llm_source      text,                         -- 'anthropic' | 'openai' | 'regex'
  routed_to       text,                         -- table the row was routed into
  routed_id       uuid,                         -- pk of the routed row
  created_at      timestamptz not null default now()
);

-- tasks: CRM / blockers / todos
create table if not exists public.tasks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  title            text not null,
  description      text,
  urgency          text not null default 'Someday',  -- Today | This Week | This Month | Someday
  key              boolean not null default false,
  priority_score   double precision not null default 0,
  time_estimate_min integer,
  tags             text[] not null default '{}',
  due_date         date,
  owner            text,
  entity_id        uuid references public.entities(id) on delete set null,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists tasks_user_urgency_idx on public.tasks (user_id, urgency);
create index if not exists tasks_user_key_idx on public.tasks (user_id, key) where completed_at is null;

-- daily_logs: one row per day per user. notes holds habits/nutrition/goals/finance JSON.
create table if not exists public.daily_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  log_date    date not null,
  notes       jsonb not null default '{}'::jsonb,
  mood        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, log_date)
);

-- memory_chunks: vector store for semantic recall
create table if not exists public.memory_chunks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  source_type text,                            -- 'capture' | 'task' | 'journal' | ...
  source_id   uuid,
  text        text not null,
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);
create index if not exists memory_chunks_embedding_idx
  on public.memory_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- audit_log: anything that touches data should leave a trace here
create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,
  action        text not null,
  resource_type text,
  resource_id   uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists daily_logs_set_updated_at on public.daily_logs;
create trigger daily_logs_set_updated_at before update on public.daily_logs
  for each row execute function public.set_updated_at();

-- RLS: deny all to anon/authenticated. Service role bypasses RLS by default.
alter table public.entities       enable row level security;
alter table public.raw_captures   enable row level security;
alter table public.tasks          enable row level security;
alter table public.daily_logs     enable row level security;
alter table public.memory_chunks  enable row level security;
alter table public.audit_log      enable row level security;

-- No policies defined => deny all for non-service-role clients.

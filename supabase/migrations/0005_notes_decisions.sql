-- Add routed capture destinations used by the capture pipeline.
-- Service-role APIs write these; RLS stays deny-all for anon/authenticated users.

create table if not exists public.decisions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  title       text not null,
  description text,
  tags        text[] not null default '{}',
  entity_id   uuid references public.entities(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  title       text not null,
  body        text,
  tags        text[] not null default '{}',
  entity_id   uuid references public.entities(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists decisions_user_created_idx on public.decisions (user_id, created_at desc);
create index if not exists notes_user_created_idx on public.notes (user_id, created_at desc);

drop trigger if exists decisions_set_updated_at on public.decisions;
create trigger decisions_set_updated_at before update on public.decisions
  for each row execute function public.set_updated_at();

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.decisions enable row level security;
alter table public.notes enable row level security;

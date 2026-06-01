-- Agency content calendar pipeline.

create table if not exists public.content_pipeline (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  client_name text not null default 'Devi',
  hook_title  text not null,
  status      text not null default 'IDEATION'
    check (status in ('IDEATION', 'SCRIPTING', 'IN_PRODUCTION', 'READY_TO_POST')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists content_pipeline_user_status_idx
  on public.content_pipeline (user_id, status, created_at desc);

drop trigger if exists content_pipeline_set_updated_at on public.content_pipeline;
create trigger content_pipeline_set_updated_at before update on public.content_pipeline
  for each row execute function public.set_updated_at();

alter table public.content_pipeline enable row level security;

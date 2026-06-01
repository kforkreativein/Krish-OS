-- Studio Engine: content diagnostics and DM outreach tracking.

create table if not exists public.script_diagnostics (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null,
  client_name       text not null,
  video_title       text not null,
  format_constant   text not null default '',
  idea_constant     text not null default '',
  hook_constant     text not null default '',
  script_constant   text not null default '',
  visual_constant   text not null default '',
  twisted_variable  text not null check (twisted_variable in ('Format', 'Idea', 'Hook', 'Script', 'Visuals')),
  views             integer not null default 0,
  engagement_status text not null default 'Testing',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists script_diagnostics_user_created_idx
  on public.script_diagnostics (user_id, created_at desc);

create table if not exists public.outreach_pipeline (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  prospect_name    text not null,
  script_variation text not null,
  status           text not null default 'Sent' check (status in ('Sent', 'Replied', 'Booked', 'Closed')),
  date_sent        date not null default current_date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists outreach_pipeline_user_status_idx
  on public.outreach_pipeline (user_id, status, date_sent desc);

drop trigger if exists script_diagnostics_set_updated_at on public.script_diagnostics;
create trigger script_diagnostics_set_updated_at before update on public.script_diagnostics
  for each row execute function public.set_updated_at();

drop trigger if exists outreach_pipeline_set_updated_at on public.outreach_pipeline;
create trigger outreach_pipeline_set_updated_at before update on public.outreach_pipeline
  for each row execute function public.set_updated_at();

alter table public.script_diagnostics enable row level security;
alter table public.outreach_pipeline enable row level security;

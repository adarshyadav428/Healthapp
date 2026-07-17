-- 024_weekly_recaps.sql
-- Stores the Sunday "weekly recap" so the Pro dashboard card can show it and
-- the free push can be sent from the same computed stats. Written by the
-- service-role cron (bypasses RLS); users may only read their own rows.

create table if not exists weekly_recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,               -- IST date of the 7-day window start
  avg_kcal integer not null,
  days_logged integer not null,
  weight_delta_kg numeric,                -- null when fewer than 2 weigh-ins
  message text not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table weekly_recaps enable row level security;

create policy "Users select own weekly recaps"
  on weekly_recaps for select using (auth.uid() = user_id);

create index if not exists weekly_recaps_user_idx
  on weekly_recaps (user_id, week_start desc);

-- 031_season_participants.sql
-- Seasons: 30-day runs with a focus, an end and a badge.
--
-- There is deliberately no `seasons` table. The season list is authored in code
-- (lib/seasons.ts) so it's versioned, reviewable and testable, and so nobody
-- has to build an admin UI or take on a weekly content chore. Only
-- participation is stored — and only the facts a replay can't derive: that the
-- user joined, and that they finished.
--
-- Progress itself is NOT stored. It's recomputed from food_logs / weight_logs
-- against the season window, for the same reason the streak is derived from log
-- history: a stored counter drifts, and there is nothing to repair when the
-- number is a function of data that's already there.

create table if not exists season_participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Matches Season.slug in lib/seasons.ts. Text rather than a foreign key
  -- precisely because the season list lives in code.
  season_slug text not null,
  joined_at timestamptz not null default now(),
  -- Set once, when the target is first met. A badge earned is kept forever,
  -- even if the user later cancels Pro — see the downgrade policy: things you
  -- EARNED persist, things you HOLD expire.
  completed_at timestamptz,
  unique (user_id, season_slug)
);

alter table season_participants enable row level security;

-- Joining a season is free and affects nobody else, so users write their own.
create policy "Users select own season participation"
  on season_participants for select using (auth.uid() = user_id);

create policy "Users join seasons"
  on season_participants for insert with check (auth.uid() = user_id);

-- Completion is stamped by the server route, which recomputes progress from the
-- logs. Users may not mark themselves complete.
create policy "Users leave seasons"
  on season_participants for delete using (auth.uid() = user_id);

create index if not exists season_participants_user_idx
  on season_participants (user_id, season_slug);

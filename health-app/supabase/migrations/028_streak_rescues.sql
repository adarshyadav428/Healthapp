-- 028_streak_rescues.sql
-- Streak Rescue: the first thing Pro ever *gives* rather than un-blocks.
--
-- Distinct from the free streak freeze (lib/streak.ts), which is earned every
-- 7 logged days and spends itself automatically to PREVENT a break. A rescue is
-- bought with a subscription and REPAIRS a break after the fact. Freezes stay
-- free forever — nothing here paywalls them.
--
-- This is the only stored state the streak has ever needed. calculateStreakState
-- still derives everything from log history and takes rescued dates as an
-- argument, so it stays pure and replayable; only the caller reads this table.

create table if not exists streak_rescues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- IST date key (YYYY-MM-DD) of the missed day being bridged. A date, not a
  -- timestamp: streaks are counted in IST calendar days and storing an instant
  -- would reintroduce the timezone ambiguity lib/streak.ts exists to avoid.
  rescued_date date not null,
  created_at timestamptz not null default now(),
  -- One rescue per day per user. Makes a double-submit (or a retried request)
  -- idempotent instead of silently burning the month's allowance twice.
  unique (user_id, rescued_date)
);

alter table streak_rescues enable row level security;

-- Users may read their own rescues; the streak calculation needs them on every
-- dashboard render.
create policy "Users select own streak rescues"
  on streak_rescues for select using (auth.uid() = user_id);

-- Deliberately NO insert policy for users. Spending a rescue requires checking
-- Pro status, the monthly allowance, and that the day is genuinely rescuable —
-- none of which RLS can express. Inserts go through the service-role route at
-- app/api/streak/rescue, which is the only place those rules live.

create index if not exists streak_rescues_user_idx
  on streak_rescues (user_id, rescued_date desc);

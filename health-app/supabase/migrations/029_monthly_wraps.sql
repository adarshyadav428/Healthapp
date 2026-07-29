-- 029_monthly_wraps.sql
-- The monthly Wrapped: a story-format recap of the user's own month.
--
-- Written by the Sunday cron on the first Sunday of each month. Deliberately
-- NOT a third Vercel cron — vercel.json declares two and the Hobby plan caps
-- there, so the monthly run rides along inside the weekly one.
--
-- Stats are stored as a snapshot rather than recomputed on read. A Wrapped is a
-- record of a month that has ended: recomputing it later against a rolling
-- window (or against logs the user has since edited) would let a story quietly
-- rewrite itself, which is the one thing a keepsake must never do.

create table if not exists monthly_wraps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- First IST day of the month being wrapped (YYYY-MM-01).
  month_start date not null,
  -- Snapshot of lib/wrappedStats.computeWrappedStats output. jsonb so the stat
  -- vocabulary can grow without a migration per card.
  stats jsonb not null,
  -- One warm sentence. AI-written for Pro, deterministic fallback for free.
  message text not null,
  -- Was this user Pro when the wrap was written?
  --
  -- The downgrade policy is "things you EARNED persist, things you HOLD
  -- expire". A Wrapped generated while paying was earned, so it stays fully
  -- readable after a cancellation — gating it on *current* status would
  -- retroactively confiscate a record of the user's own month.
  was_pro boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, month_start)
);

alter table monthly_wraps enable row level security;

create policy "Users select own monthly wraps"
  on monthly_wraps for select using (auth.uid() = user_id);

-- No insert/update policy: only the service-role cron writes these.

create index if not exists monthly_wraps_user_idx
  on monthly_wraps (user_id, month_start desc);

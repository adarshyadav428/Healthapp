-- 033_push_sends.sql
-- One row per notification actually delivered, so the push budget has
-- something to count.
--
-- Before this nothing coordinated the senders: the daily reminder cron and the
-- Sunday recap cron both fired on a Sunday, and the monthly Wrapped would have
-- made three on the first Sunday of a month. The risk isn't annoyance, it's
-- permission revocation — an over-pushed Android user disables notifications
-- wholesale and takes the streak-save nudge, the one that actually works, down
-- with them.

create table if not exists push_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Matches PushKind in lib/pushBudget.ts.
  kind text not null,
  -- IST calendar day the send counted against. A date, not a timestamp: the
  -- cap is "one a day" as a user experiences days, and IST is the app's day
  -- everywhere else (streaks, logs, recaps).
  sent_on date not null,
  -- Stamped by the service worker when the notification is opened. NULL means
  -- delivered-and-ignored, which is what drives the back-off.
  opened_at timestamptz,
  created_at timestamptz not null default now()
);

alter table push_sends enable row level security;

create policy "Users select own push sends"
  on push_sends for select using (auth.uid() = user_id);

-- Written only by the service-role crons.

create index if not exists push_sends_user_day_idx
  on push_sends (user_id, sent_on desc);

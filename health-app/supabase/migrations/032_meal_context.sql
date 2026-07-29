-- 032_meal_context.sql
-- Where a meal was eaten: home / restaurant / travel / office.
--
-- Deliberately ONE nullable column on an existing table, not a new tracker.
-- Migration 019 dropped water_logs, sleep_logs, fasting_sessions and
-- measurements_logs because the extra trackers diluted the app; this is not a
-- reopening of that. There is no new screen, no new table, and no nagging —
-- the field is optional and a log without one is a perfectly good log.
--
-- It earns its place by answering a question the app couldn't: "why are some
-- weeks worse than others". Restaurant days are usually several hundred
-- calories heavier, and nobody can see that without this tag.

alter table food_logs
  add column if not exists context text;

alter table food_logs
  drop constraint if exists food_logs_context_check;

alter table food_logs
  add constraint food_logs_context_check
  check (context is null or context in ('home', 'restaurant', 'travel', 'office'));

-- Partial index: the overwhelming majority of rows will have no context, and
-- every query that cares filters them out anyway.
create index if not exists food_logs_context_idx
  on food_logs (user_id, context)
  where context is not null;

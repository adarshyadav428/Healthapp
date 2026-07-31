-- 036_reminder_hour.sql
--
-- Let a user choose when the daily reminder arrives.
--
-- Until now there was one fixed evening nudge (the Vercel cron at 15:00 UTC =
-- 20:30 IST). That is the wrong time for a large share of users: someone who
-- eats dinner at 21:30 is being asked to log a meal they have not had, and
-- someone who logs over breakfast never needed the evening prompt at all. A
-- reminder that arrives at the wrong moment is not neutral — it is the thing
-- that gets notifications turned off, and permission revocation is the one risk
-- lib/pushBudget.ts exists to manage.
--
-- Stored as an IST hour (0-23), not a timestamp and not a UTC hour:
--
--   * The whole app defines "a day" in IST (see lib/dateUtils and the note in
--     019/032). A reminder hour in any other zone would be the second competing
--     definition of a day, which is the exact bug class deleted on 2026-07-31.
--   * An hour, not a minute-precision time, because delivery is only as precise
--     as the scheduler that triggers it. Offering "20:15" would promise accuracy
--     the transport cannot keep.
--
-- Default 20 preserves today's behaviour exactly for every existing user: the
-- catch-all cron still runs at 20:30 IST, so anyone who never opens the setting
-- sees no change at all.
--
-- Range is enforced in the database rather than only in Zod, because the cron
-- matches on this value and an out-of-range hour would silently mean "never".

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS reminder_hour smallint NOT NULL DEFAULT 20;

-- Idempotent: re-running must not fail on an existing constraint.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_reminder_hour_range;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_reminder_hour_range
  CHECK (reminder_hour >= 0 AND reminder_hour <= 23);

COMMENT ON COLUMN profiles.reminder_hour IS
  'IST hour (0-23) at which the daily log reminder should fire. Default 20 matches the pre-036 fixed evening nudge.';

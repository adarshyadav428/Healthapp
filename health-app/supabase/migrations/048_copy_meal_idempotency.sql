-- P2 (2026-09-05 QA follow-up): /api/logs/copy-meal has zero duplicate-
-- submission protection. A rapid double-tap or a race between two
-- near-simultaneous requests re-inserts the whole meal a second time.
-- Confirmed against the real database: two concurrent requests produced two
-- identical rows.
--
-- copy-yesterday (migration 047) already tags a copy with copied_from_id and
-- enforces at most one copy per source row via a GLOBAL unique index. That
-- global uniqueness is correct there because copy-yesterday only ever has one
-- possible target (today) for a given source (yesterday) at the moment it
-- runs. copy-meal does NOT have that property: pasting the same saved
-- breakfast onto two different days is a normal, legitimate action — a global
-- "this source row has been copied once, ever" constraint would wrongly block
-- the second, unrelated paste.
--
-- The fix generalises the constraint to (copied_from_id, target IST day)
-- instead of (copied_from_id) alone. This is a strict widening, not a
-- behaviour change, for copy-yesterday: its target is always "today" at call
-- time, so the composite key and the old single-column key coincide for
-- every real call it makes. For copy-meal, the added day component is what
-- lets a source row be copied to many different days while still catching a
-- same-day double-tap/race/retry as a duplicate.
--
-- Expression index, not a stored column: logged_at is already the row's own
-- timestamp, and (logged_at AT TIME ZONE 'Asia/Kolkata')::date reproduces the
-- app's IST day boundary (lib/dateUtils.ts istDateStr) without adding a
-- column nothing else needs.
DROP INDEX IF EXISTS idx_food_logs_copied_from_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_food_logs_copied_from_id_target_day
  ON food_logs (copied_from_id, ((logged_at AT TIME ZONE 'Asia/Kolkata')::date))
  WHERE copied_from_id IS NOT NULL;

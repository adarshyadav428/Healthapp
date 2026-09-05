-- F3 (2026-09-05 adversarial-audit): rapid double-tap on "Save weight" or the
-- exercise logger creates a duplicate row. Both client guards were `useState`
-- only (`disabled={isSubmitting}`), which does not close a same-tick double
-- click/tap race, and neither table has any constraint that would catch a
-- duplicate that gets through.
--
-- There is no natural key here: unlike streak_rescues (one rescue per
-- calendar day is a real business rule), weight and exercise both legitimately
-- allow multiple same-day, even same-value, entries — a morning and an
-- evening weigh-in, two workouts in one day. Only a client-supplied operation
-- identity can distinguish "the same submission, retried or raced" from "a
-- genuinely separate entry", so this adds a client-generated idempotency key:
-- generated once per modal-open, sent with the insert, unique per user.
--
-- Nullable and partial-indexed so it never affects existing rows or any other
-- insert path into these tables.

ALTER TABLE weight_logs ADD COLUMN IF NOT EXISTS client_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS idx_weight_logs_user_client_request_id
  ON weight_logs (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS client_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_logs_user_client_request_id
  ON exercise_logs (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

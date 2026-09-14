-- 2026-09-13 remediation (R8, authenticated QA pass): two genuinely
-- simultaneous POST /api/logs/add requests both returned 200 and both rows
-- persisted — confirmed against production. weight_logs and exercise_logs
-- already got a client_request_id idempotency key (migration 046); food_logs
-- itself already has one for BULK copies (copied_from_id, 047/048), but the
-- single-item insert paths (/api/logs/add, /api/logs/quick-add) never got
-- the same treatment — a documented, deliberate scope boundary at the time
-- (CLAUDE.md), now shown live-exploitable.
--
-- Same mechanism as 046: a client-generated key, sent once per modal-open,
-- unique per (user_id, client_request_id). A rapid double-tap, a same-tick
-- race, or a client retry after a timeout all carry the SAME key and
-- collapse into one row; a genuinely separate log (the user reopens the
-- form) gets a fresh key and is unaffected.
--
-- Nullable and partial-indexed, so every other insert path into food_logs
-- (search without this column set, camera/chat add-bulk, saved combos,
-- copy-yesterday, copy-meal) is untouched.

ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS client_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS idx_food_logs_user_client_request_id
  ON food_logs (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

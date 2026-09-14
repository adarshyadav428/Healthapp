-- 2026-09-14 release-hardening pass: /api/logs/add-bulk (camera multi-food,
-- chat multi-food) and /api/meals/log (saved-combo logging) had NO
-- duplicate-submission protection at all — only client-side useState guards,
-- which close a same-tick double-tap in the common case but not a network
-- retry, a client crash/retry, or two genuinely simultaneous requests. Either
-- route can duplicate an entire meal (2-8 rows for add-bulk; every item in a
-- saved combo for meals/log) in one bad submit.
--
-- NOT the same mechanism as 049. 049's unique index is on
-- (user_id, client_request_id) alone — exactly one row per key — because
-- /api/logs/add always writes one row per request. add-bulk and meals/log
-- write N rows (2-8, or however many items a combo has) per request, and all
-- N legitimately share ONE client-generated key (the whole batch is one
-- logical submission). Reusing 049's column and index would let only the
-- FIRST row of a batch ever insert: the 2nd row sharing the same
-- client_request_id would 23505 against the 1st, even on a batch's first,
-- non-duplicate submission. So this is a genuinely different shape, not
-- 046/049's single-item pattern copy-pasted: a client-generated key shared by
-- every row in the batch, PLUS each row's ordinal position within that
-- batch, unique together.
--
-- A retry that resends the identical items array in the identical order
-- reproduces the identical (batch_request_id, batch_seq) pairs, so the whole
-- batch collapses into the rows already written; a genuinely new submission
-- (the user logs a different plate, or intentionally logs the same saved
-- meal again) gets a fresh batch_request_id and is unaffected. See
-- insertIdempotentBatch (lib/requestIdempotency.ts).
--
-- Nullable and partial-indexed, so every other insert path into food_logs is
-- untouched, and an older client that doesn't send the field behaves exactly
-- as it does today (unprotected, not broken).

ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS batch_request_id uuid;
ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS batch_seq smallint;
CREATE UNIQUE INDEX IF NOT EXISTS idx_food_logs_user_batch_request_seq
  ON food_logs (user_id, batch_request_id, batch_seq)
  WHERE batch_request_id IS NOT NULL;

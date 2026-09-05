-- F4 (2026-09-05 adversarial-audit): /api/logs/copy-yesterday has no dedup at
-- all, client or server. A rapid double-tap duplicates every one of
-- yesterday's logs onto today.
--
-- food_logs rows have no natural key identifying which bulk-copy produced
-- them, and the operation's identity (source day -> target day) is entirely
-- implicit in "yesterday/today at call time". copied_from_id records which
-- original row a copy came from; a partial unique index makes each source
-- row copyable at most once, which is exactly the idempotency this endpoint
-- needs — "yesterday" and "today" are each a single fixed day per call, so
-- re-running the same copy tries to reuse the same source ids and is
-- rejected, while copying a genuinely different day (tomorrow, next week)
-- always touches different source rows and is unaffected.
--
-- ON DELETE SET NULL, never CASCADE: deleting the original entry must never
-- delete the copy that was made from it — they are independent diary rows
-- from the moment the copy lands. Nullable and partial-indexed so it never
-- affects any other insert path into food_logs (saved combos, search,
-- camera, chat, quick-add all insert with this column simply absent).

ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS copied_from_id uuid REFERENCES food_logs(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_food_logs_copied_from_id
  ON food_logs (copied_from_id)
  WHERE copied_from_id IS NOT NULL;

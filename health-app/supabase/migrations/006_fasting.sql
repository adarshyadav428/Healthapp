-- 006_fasting.sql
-- Intermittent fasting session tracking.
-- Run once in Supabase Dashboard → SQL Editor. Idempotent.

CREATE TABLE IF NOT EXISTS fasting_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  target_hours numeric     NOT NULL DEFAULT 16,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fasting_sessions_user
  ON fasting_sessions (user_id, started_at DESC);

ALTER TABLE fasting_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fasting_select ON fasting_sessions;
DROP POLICY IF EXISTS fasting_insert ON fasting_sessions;
DROP POLICY IF EXISTS fasting_update ON fasting_sessions;
DROP POLICY IF EXISTS fasting_delete ON fasting_sessions;

CREATE POLICY fasting_select ON fasting_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY fasting_insert ON fasting_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY fasting_update ON fasting_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY fasting_delete ON fasting_sessions FOR DELETE USING (auth.uid() = user_id);

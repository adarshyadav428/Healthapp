-- 003_combined_pending.sql
-- Run this ONCE in Supabase Dashboard → SQL Editor to enable:
--   • Exercise logging
--   • Water tracking (water_target_ml on profiles)
-- All statements are idempotent — safe to run multiple times.

-- ─── EXERCISE LOGS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity text NOT NULL,
  duration_min numeric NOT NULL,
  calories numeric NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_logs_user_logged_at
  ON exercise_logs (user_id, logged_at DESC);

ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exercise_logs_select ON exercise_logs;
DROP POLICY IF EXISTS exercise_logs_insert ON exercise_logs;
DROP POLICY IF EXISTS exercise_logs_update ON exercise_logs;
DROP POLICY IF EXISTS exercise_logs_delete ON exercise_logs;

CREATE POLICY exercise_logs_select ON exercise_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY exercise_logs_insert ON exercise_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY exercise_logs_update ON exercise_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY exercise_logs_delete ON exercise_logs FOR DELETE USING (auth.uid() = user_id);

-- ─── WATER LOGS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ml integer NOT NULL CHECK (ml > 0),
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_water_logs_user_logged_at
  ON water_logs (user_id, logged_at DESC);

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS water_logs_select ON water_logs;
DROP POLICY IF EXISTS water_logs_insert ON water_logs;
DROP POLICY IF EXISTS water_logs_delete ON water_logs;

CREATE POLICY water_logs_select ON water_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY water_logs_insert ON water_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY water_logs_delete ON water_logs FOR DELETE USING (auth.uid() = user_id);

-- ─── WATER TARGET ON PROFILE ───────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS water_target_ml integer NOT NULL DEFAULT 2500;

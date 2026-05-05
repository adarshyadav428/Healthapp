-- 002_exercise_logs.sql
-- Adds exercise logs for workout tracking

CREATE TABLE IF NOT EXISTS exercise_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity text NOT NULL,
  duration_min numeric NOT NULL,
  calories numeric NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_logs_user_logged_at ON exercise_logs (user_id, logged_at);

ALTER TABLE IF EXISTS exercise_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exercise_logs_select ON exercise_logs;
DROP POLICY IF EXISTS exercise_logs_insert ON exercise_logs;
DROP POLICY IF EXISTS exercise_logs_update ON exercise_logs;
DROP POLICY IF EXISTS exercise_logs_delete ON exercise_logs;
CREATE POLICY exercise_logs_select ON exercise_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY exercise_logs_insert ON exercise_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY exercise_logs_update ON exercise_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY exercise_logs_delete ON exercise_logs FOR DELETE USING (auth.uid() = user_id);

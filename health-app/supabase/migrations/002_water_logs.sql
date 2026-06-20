-- 002_water_logs.sql
-- Adds water tracking: water_logs table + water_target_ml on profiles

-- Water logs
CREATE TABLE IF NOT EXISTS water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ml integer NOT NULL CHECK (ml > 0),
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_water_logs_user_logged_at ON water_logs (user_id, logged_at DESC);

-- Water target on profile (default 2500 ml ≈ 10 cups)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS water_target_ml integer NOT NULL DEFAULT 2500;

-- RLS
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS water_logs_select ON water_logs;
DROP POLICY IF EXISTS water_logs_insert ON water_logs;
DROP POLICY IF EXISTS water_logs_delete ON water_logs;

CREATE POLICY water_logs_select ON water_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY water_logs_insert ON water_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY water_logs_delete ON water_logs FOR DELETE USING (auth.uid() = user_id);

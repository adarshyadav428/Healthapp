-- 005_pace_sleep.sql
-- Adds pace_kg_per_week to profiles and sleep_logs table.
-- Run once in Supabase Dashboard → SQL Editor. Idempotent.

-- ─── PACE COLUMN ON PROFILES ───────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pace_kg_per_week numeric DEFAULT 0.5;

-- ─── SLEEP LOGS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sleep_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sleep_date   date        NOT NULL DEFAULT CURRENT_DATE,
  bedtime      timestamptz NOT NULL,
  wake_time    timestamptz NOT NULL,
  quality      integer     CHECK (quality BETWEEN 1 AND 5),
  notes        text,
  created_at   timestamptz DEFAULT now()
);

-- At most one log per user per sleep_date
CREATE UNIQUE INDEX IF NOT EXISTS idx_sleep_logs_user_date
  ON sleep_logs (user_id, sleep_date);

CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_created
  ON sleep_logs (user_id, created_at DESC);

ALTER TABLE sleep_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sleep_select ON sleep_logs;
DROP POLICY IF EXISTS sleep_insert ON sleep_logs;
DROP POLICY IF EXISTS sleep_update ON sleep_logs;
DROP POLICY IF EXISTS sleep_delete ON sleep_logs;

CREATE POLICY sleep_select ON sleep_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY sleep_insert ON sleep_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY sleep_update ON sleep_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY sleep_delete ON sleep_logs FOR DELETE USING (auth.uid() = user_id);

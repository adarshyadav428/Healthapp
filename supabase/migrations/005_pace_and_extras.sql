-- 005_pace_and_extras.sql
-- Run once in Supabase Dashboard → SQL Editor
-- Idempotent — safe to run multiple times.

-- Add pace_kg_per_week to profiles (used for goal-date prediction and TDEE auto-recalculation)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pace_kg_per_week numeric DEFAULT 0.5;

-- Ensure water_target_ml exists (may already be present from migration 003)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS water_target_ml integer NOT NULL DEFAULT 2500;

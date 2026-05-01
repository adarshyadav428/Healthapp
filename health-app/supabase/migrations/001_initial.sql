-- 001_initial.sql
-- Creates core tables for profiles, foods, food_logs, weight_logs, subscriptions
-- Enables RLS and adds trigger to auto-create profile on new auth user

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  display_name text,
  height_cm numeric,
  current_weight_kg numeric,
  target_weight_kg numeric,
  age integer,
  sex text,
  activity_level text,
  goal text,
  daily_calorie_target integer,
  protein_g_target integer,
  carbs_g_target integer,
  fat_g_target integer,
  unit_system text DEFAULT 'metric',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Foods
CREATE TABLE IF NOT EXISTS foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_id text,
  name text NOT NULL,
  brand text,
  serving_size_g numeric NOT NULL,
  serving_description text,
  kcal_per_100g numeric NOT NULL,
  protein_g_per_100g numeric NOT NULL,
  carbs_g_per_100g numeric NOT NULL,
  fat_g_per_100g numeric NOT NULL,
  fiber_g_per_100g numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE foods ADD CONSTRAINT foods_source_unique UNIQUE (source, source_id);

CREATE INDEX IF NOT EXISTS foods_name_idx ON foods USING gin (to_tsvector('english', name));

-- Food logs
CREATE TABLE IF NOT EXISTS food_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  meal text NOT NULL,
  servings numeric NOT NULL,
  grams numeric NOT NULL,
  kcal numeric NOT NULL,
  protein_g numeric NOT NULL,
  carbs_g numeric NOT NULL,
  fat_g numeric NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_logs_user_logged_at ON food_logs (user_id, logged_at);

-- Weight logs
CREATE TABLE IF NOT EXISTS weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg numeric NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weight_logs_user_measured_at ON weight_logs (user_id, measured_at DESC);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  plan text,
  current_period_end timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_set_timestamp
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER subscriptions_set_timestamp
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Auto-create profile on new auth.user (Supabase auth.users)
-- Requires that auth.users insert trigger calls this function; adapt as needed.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO profiles (id, email, created_at)
    VALUES (NEW.id, NEW.email, now())
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- RLS: Enable row level security and policies
-- Note: Supabase uses auth.uid() to provide current user id in policies

ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_insert ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;
DROP POLICY IF EXISTS profiles_delete ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_delete ON profiles FOR DELETE USING (auth.uid() = id);

ALTER TABLE IF EXISTS foods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS foods_select ON foods;
DROP POLICY IF EXISTS foods_insert ON foods;
DROP POLICY IF EXISTS foods_update ON foods;
DROP POLICY IF EXISTS foods_delete ON foods;
CREATE POLICY foods_select ON foods FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY foods_insert ON foods FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY foods_update ON foods FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY foods_delete ON foods FOR DELETE USING (auth.uid() IS NOT NULL);

ALTER TABLE IF EXISTS food_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS food_logs_select ON food_logs;
DROP POLICY IF EXISTS food_logs_insert ON food_logs;
DROP POLICY IF EXISTS food_logs_update ON food_logs;
DROP POLICY IF EXISTS food_logs_delete ON food_logs;
CREATE POLICY food_logs_select ON food_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY food_logs_insert ON food_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY food_logs_update ON food_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY food_logs_delete ON food_logs FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE IF EXISTS weight_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS weight_logs_select ON weight_logs;
DROP POLICY IF EXISTS weight_logs_insert ON weight_logs;
DROP POLICY IF EXISTS weight_logs_update ON weight_logs;
DROP POLICY IF EXISTS weight_logs_delete ON weight_logs;
CREATE POLICY weight_logs_select ON weight_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY weight_logs_insert ON weight_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY weight_logs_update ON weight_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY weight_logs_delete ON weight_logs FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subs_select ON subscriptions;
DROP POLICY IF EXISTS subs_insert ON subscriptions;
DROP POLICY IF EXISTS subs_update ON subscriptions;
DROP POLICY IF EXISTS subs_delete ON subscriptions;
CREATE POLICY subs_select ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY subs_insert ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY subs_update ON subscriptions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY subs_delete ON subscriptions FOR DELETE USING (auth.uid() = user_id);

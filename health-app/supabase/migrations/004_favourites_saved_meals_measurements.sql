-- ============================================================
-- Migration 004: food_favourites, saved_meals, measurements_logs
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Food Favourites ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS food_favourites (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  food_id     uuid REFERENCES foods(id)      ON DELETE CASCADE NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, food_id)
);
ALTER TABLE food_favourites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favourites" ON food_favourites
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 2. Saved Meals ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_meals (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  created_at  timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE saved_meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved meals" ON saved_meals
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS saved_meal_items (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id   uuid REFERENCES saved_meals(id) ON DELETE CASCADE NOT NULL,
  food_id   uuid REFERENCES foods(id)       ON DELETE CASCADE NOT NULL,
  grams     numeric NOT NULL CHECK (grams > 0),
  servings  numeric NOT NULL DEFAULT 1 CHECK (servings > 0)
);
ALTER TABLE saved_meal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own meal items" ON saved_meal_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM saved_meals WHERE id = saved_meal_items.meal_id AND user_id = auth.uid())
  );
CREATE POLICY "Users insert own meal items" ON saved_meal_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM saved_meals WHERE id = saved_meal_items.meal_id AND user_id = auth.uid())
  );
CREATE POLICY "Users delete own meal items" ON saved_meal_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM saved_meals WHERE id = saved_meal_items.meal_id AND user_id = auth.uid())
  );

-- ── 3. Body Measurements ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS measurements_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  waist_cm    numeric CHECK (waist_cm > 0),
  chest_cm    numeric CHECK (chest_cm > 0),
  hips_cm     numeric CHECK (hips_cm > 0),
  arms_cm     numeric CHECK (arms_cm > 0),
  measured_at date NOT NULL DEFAULT current_date,
  created_at  timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE measurements_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own measurements" ON measurements_logs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

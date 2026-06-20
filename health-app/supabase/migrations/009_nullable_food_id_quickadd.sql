-- 009_nullable_food_id_quickadd.sql
-- Quick-add logs are calorie notes, not real food entries.
-- Remove the foods-table dependency by making food_id nullable.

-- Step 1: drop NOT NULL so existing rows can be updated
ALTER TABLE food_logs ALTER COLUMN food_id DROP NOT NULL;

-- Step 2: detach existing quick-add log rows from their ephemeral food entries
UPDATE food_logs
SET food_id = NULL
WHERE food_id IN (
  SELECT id FROM foods
  WHERE source = 'user'
    AND source_id LIKE 'quickadd_%'
);

-- Step 3: delete the now-orphaned quick-add food rows
DELETE FROM foods
WHERE source = 'user'
  AND source_id LIKE 'quickadd_%';

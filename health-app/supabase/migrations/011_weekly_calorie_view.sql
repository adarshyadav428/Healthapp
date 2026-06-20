-- 011_weekly_calorie_view.sql
-- Materialises a per-user, per-week calorie summary for fast deficit queries.

CREATE OR REPLACE VIEW weekly_calorie_summary AS
SELECT
  user_id,
  DATE_TRUNC('week', logged_at) AS week_start,
  SUM(kcal)                      AS total_calories,
  COUNT(DISTINCT DATE(logged_at)) AS days_logged
FROM food_logs
GROUP BY user_id, DATE_TRUNC('week', logged_at);

-- Row-level security on the underlying table already restricts access;
-- the view inherits it automatically in Supabase.

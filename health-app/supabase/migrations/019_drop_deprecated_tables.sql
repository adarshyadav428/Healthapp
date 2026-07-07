-- 019_drop_deprecated_tables.sql
-- Removes water, sleep, fasting, and body-measurement tracking — cut from the UI
-- (commits 9aee403, 20eb073) and now from the API/hooks/components too. Per the
-- product roadmap, GetInShape's one job is AI photo/chat food logging; these
-- were never load-bearing for that and are dead weight.
--
-- DESTRUCTIVE: this permanently deletes any rows any user has ever logged in
-- these tables. Run manually in Supabase Dashboard → SQL Editor only when you
-- are sure you don't want this data back (e.g. after confirming via a backup
-- or that these features had ~0 usage). Not run automatically.

DROP TABLE IF EXISTS water_logs;
DROP TABLE IF EXISTS sleep_logs;
DROP TABLE IF EXISTS fasting_sessions;
DROP TABLE IF EXISTS measurements_logs;

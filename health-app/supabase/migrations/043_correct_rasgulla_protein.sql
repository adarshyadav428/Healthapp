-- 043_correct_rasgulla_protein.sql
--
-- One value correction to a row added by 041_branded_foods_v2.sql, in the style
-- of 038_correct_mislabelled_food_rows.sql and 042: a guarded, idempotent
-- UPDATE keyed on source_id.
--
-- NEVER A DELETE. food_logs, food_favourites, saved_meal_items and
-- food_dismissals all reference foods ON DELETE CASCADE. Past diaries do not
-- move either way — food_logs snapshots its own kcal and macros at log time.
--
-- ── What, and why ────────────────────────────────────────────────────────────
--
-- 041 wrote branded-haldirams-rasgulla as 186 kcal / 2.5 protein / 40.0 carbs /
-- 1.5 fat. 007_seed_indian_foods.sql's ifct-rasgulla is 186 / 4.5 / 40.2 / 1.5:
-- identical kcal, identical fat, carbs within 0.2 — and protein different by
-- 80%. The branded row was evidently derived from the measured IFCT row with
-- the protein altered somewhere in transcription.
--
-- Both rows are visible in the same search, so whichever one a user taps
-- decides their protein total for the day, and the two disagree by nearly
-- double. That disagreement is the harm this fixes.
--
-- ── Provenance, stated plainly ───────────────────────────────────────────────
--
-- This is NOT a panel read off a Haldiram's tin. It aligns the branded row to
-- the measured IFCT value it came from, which is defensible because the rest of
-- the row already matches that source exactly — but 4.5 must NOT be treated as
-- verified. If a tin is ever checked and disagrees, correct it again with
-- another guarded UPDATE rather than assuming this one settled it. The row
-- stays flagged in docs/branded-foods-041-verification.md until someone reads a
-- pack.
--
-- Note the deliberate divergence this creates: 041 is already applied, so its
-- file still reads 2.5 while the database reads 4.5. That is inherent to
-- correcting by migration rather than editing an applied file, and it is why
-- every correction has to be readable on its own.
--
-- Guarded on the exact value 041 wrote, so re-running this file is a no-op, and
-- so is running it against a database where 041 was never applied.

update foods
   set protein_g_per_100g = 4.5
 where source = 'branded'
   and source_id = 'branded-haldirams-rasgulla'
   -- guard: only the row exactly as 041 wrote it
   and protein_g_per_100g = 2.5;

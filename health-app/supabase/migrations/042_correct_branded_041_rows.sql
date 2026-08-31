-- 042_correct_branded_041_rows.sql
--
-- Corrections to rows added by 041_branded_foods_v2.sql, in the style of
-- 038_correct_mislabelled_food_rows.sql: guarded, idempotent UPDATEs keyed on
-- source_id.
--
-- NEVER A DELETE. food_logs, food_favourites, saved_meal_items and
-- food_dismissals all reference foods ON DELETE CASCADE, so one delete silently
-- wipes that food from every user's diary with no error. An UPDATE is safe in
-- both directions: food_logs snapshots its own kcal and macros at log time, so
-- no past diary entry moves when a row is corrected.
--
-- Every statement carries a guard on the exact value 041 wrote. Re-running this
-- file is therefore a no-op, and so is running it against a database where 041
-- was never applied — which matters, because migrations here are applied by
-- hand in the Supabase SQL editor and nothing records which have been run.

-- ── 1. Amul Ghee disagreed with itself about a tablespoon ────────────────────
--
-- 041 wrote serving_size_g = 10 with serving_description '1 tbsp (10g)', while
-- the same row's common_portions called a tablespoon 14 g. One row, two
-- answers — and they surface in different places: app/foods/[slug] renders the
-- description, the add-modal reads the portions. This aligns the portions to
-- the row's own stated serving; the Amul Butter row directly above it in 041
-- also calls a tablespoon 10 g.
--
-- NOT fixed here, on purpose: whether a tablespoon of ghee is 10 g or ~14 g is
-- a pack-in-hand question, and this migration corrects no value it cannot
-- verify. It is tracked in docs/branded-foods-041-verification.md. Note also
-- that lib/portion-units.ts's /ghee|butter/ rule offers "1 tbsp (15g)" and a
-- SMART_PORTIONS name match suppresses common_portions entirely, so this row's
-- picker shows 15 g either way. What this statement removes is the
-- contradiction inside the row, not the disagreement with the rule.

update foods
   set common_portions = '[{"unit":"teaspoon","grams":5,"label":"1 tsp (5g)"},{"unit":"tablespoon","grams":10,"label":"1 tbsp (10g)"},{"unit":"gram","grams":100,"label":"100g"}]'::jsonb
 where source = 'branded'
   and source_id = 'branded-amul-ghee'
   -- guard: only the row exactly as 041 wrote it, so a second run does nothing
   and common_portions::text like '%"1 tbsp (14g)"%';

-- ── Found in review, deliberately NOT corrected here ─────────────────────────
--
-- Four 041 rows duplicate measured IFCT rows that already existed, and three of
-- those carry IFCT-derived values while claiming the label-accurate provenance
-- that source='branded' (SOURCE_RANK 4) asserts. None of them is corrected by
-- this file, because the correction needs a nutrition panel read off a pack and
-- guessing one would make a rank-4 row *more* confidently wrong, not less:
--
--   * branded-amul-butter      — duplicates ifct-butter ('Butter (Amul)',
--                                007_seed_indian_foods.sql) and
--                                ifct-amul-butter-unsalted (017_expanded_foods.sql).
--                                041's header claim that no butter row existed
--                                is false. Three rows, same product.
--   * branded-haldirams-rasgulla — duplicates ifct-rasgulla with protein 2.5
--                                vs 4.5; same kcal, same fat, carbs within 0.2.
--                                The two visible rows disagree by 80% on protein.
--   * branded-nutrela-soya-chunks — values byte-identical to ifct-soya-chunks-dry
--                                (017); a third row exists in 010.
--   * branded-aashirvaad-atta  — values are ifct-atta's generic wheat-flour
--                                numbers (341/12.1/69.4/1.7), fibre aside.
--
-- All four are logged in docs/branded-foods-041-verification.md as
-- provenance-failed. Note that removing a duplicate is not available as a fix:
-- foods has no soft-delete column and DELETE is forbidden. Search dedupes by
-- normalised name + brand (lib/mergeSearchResults.ts), so a rename could
-- collapse a duplicate behind the higher-ranked IFCT row — that is a product
-- decision about what users see, not a data correction, and is not taken here.

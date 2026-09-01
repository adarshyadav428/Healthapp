-- 043_correct_duplicate_cluster_rows.sql
--
-- Corrections found while building the search-result collapse
-- (collapseDuplicateFoods, lib/mergeSearchResults.ts) and its data-quality
-- guardrail (tests/foodDataQuality.test.ts). In the style of
-- 038_correct_mislabelled_food_rows.sql and 042_correct_branded_041_rows.sql:
-- guarded, idempotent UPDATEs keyed on source_id.
--
-- NEVER A DELETE. food_logs, food_favourites, saved_meal_items and
-- food_dismissals all reference foods ON DELETE CASCADE, so one delete silently
-- wipes that food from every user's diary with no error. An UPDATE is safe in
-- both directions: food_logs snapshots its own kcal and macros at log time, so
-- no past diary entry moves when a row is corrected.
--
-- Every statement carries a guard on the exact value already live. Re-running
-- this file is therefore a no-op, and so is running it against a database
-- that seeded lib/indian-foods-data.ts's corrected value directly and never
-- carried the wrong one — which matters, because migrations here are applied
-- by hand in the Supabase SQL editor and nothing records which have been run.

-- ── 1. Boiled Egg (Anda) had fat copied from protein ─────────────────────────
--
-- The row shipped at kcal 173, protein 13.3, fat 13.3 — the fat figure reads
-- as a copy-paste of the protein figure, and 173 is exactly
-- 4×13.3 + 9×13.3 rounded, so the stated kcal was internally *consistent*
-- with the wrong fat. An Atwater-consistency check cannot catch this class of
-- bug; only checking the source can. This is also the row a curated estimate
-- named plain "Boiled Egg" (108 kcal) and an Open Food Facts "Boiled egg"
-- (140 kcal) were clustering against under the search collapse this
-- migration accompanies — three different numbers for one food, the badge
-- that used to sit on each card asking the user to pick.
--
-- Corrected against IFCT 2017 itself (nodef/ifct2017, code M004, "Egg,
-- poultry, whole, boiled": energy 618 kJ ÷ 4.184 ≈ 148 kcal, protein 13.43 g,
-- fat 10.54 g, carbohydrate 0, fibre 0) rather than re-deriving a number from
-- the row's own (wrong) macros. Protein was already correct to one decimal
-- and is left as-is.
update foods
   set kcal_per_100g = 148,
       fat_g_per_100g = 10.5
 where source = 'ifct'
   and source_id = 'ifct-egg-boiled'
   -- guard: only the row exactly as it originally shipped, so a second run
   -- (or a database seeded from the already-corrected lib/indian-foods-data.ts)
   -- does nothing
   and kcal_per_100g = 173
   and fat_g_per_100g = 13.3;

-- ── Found in review, deliberately NOT corrected here ─────────────────────────
--
-- Building tests/foodDataQuality.test.ts's cluster-disagreement check (>20%
-- kcal spread inside one foodClusterKey cluster) surfaced one more real
-- duplicate: the curated "Corn Chaat" existed twice in
-- scripts/generate-indian-foods-estimate.ts's item list — once under the
-- 'street' category and once under 'snack' — each generating a different
-- macro estimate for the identical literal name (264.5 vs 219.9 kcal). That
-- is a generator-input duplicate, not a production data value to UPDATE: it
-- was fixed by removing the 'snack' occurrence and re-running the generator
-- (`npx tsx scripts/generate-indian-foods-estimate.ts`), which changed
-- `source_id`s in `data/indian-foods.json` rather than any existing row's
-- values. Nothing to migrate for it here; any already-seeded 'estimate'-style
-- duplicate row is superseded going forward by `collapseDuplicateFoods`
-- electing the single surviving `curated` source_id at search time.

-- 038_correct_mislabelled_food_rows.sql
--
-- Correct food rows whose stored values misrepresent what is in the pack.
--
-- Follows 037_name_packaged_moong_dal.sql. Everything here is keyed on
-- `source_id` — the Open Food Facts barcode, or the generated `est-` id — so
-- each statement can only touch the rows audited below and cannot drift onto a
-- row added later.
--
-- UPDATE only. Never DELETE from `foods`: food_logs, food_favourites,
-- saved_meal_items and food_dismissals all reference it ON DELETE CASCADE, so
-- one delete silently wipes that food from every user's diary. Both a rename
-- and a macro correction are safe — food_logs references the row by `id` and
-- snapshots its own kcal/macros at log time, so nobody's past diary moves.
--
-- Verified against the live table on 2026-08-22.


-- ── A. The 35 g namkeen pouch whose per-serving column landed in per-100 g ───
--
-- off_8904063200136 / offi_8904063200136 — "Moong Dal", Haldiram's, the two
-- rows migration 037 deliberately held back. They read 160 kcal at P7 C18 F7,
-- which is neither cooked dal (104, P7.6, F0.4) nor fried namkeen (476, P21,
-- F21). Three things say the label's per-serving column was entered into the
-- per-100 g fields:
--
--   * serving_size_g = 35, serving_description = "1 cup (35 g)" — the
--     single-serve namkeen pouch. A ready-to-eat dal pouch would be ~300 g.
--   * every value sits at 0.33-0.35 of the known Haldiram's Moong Dal namkeen
--     (off_8904004403718: 476 / 21.31 / 50.66 / 20.93). 35/100 = 0.35.
--   * the 8904063 block is Haldiram's Nagpur namkeen line — every other row we
--     hold on that prefix is a snack (Bhujia, Aloo Bhujia, Punjabi Tadka,
--     Golden Mixture, and offi_8904063240286, renamed by 037).
--
-- So rescale by the row's OWN serving_size_g rather than importing another
-- product's numbers: 160 x 100/35 = 457.1 / 20.0 / 51.4 / 20.0, which lands on
-- the known namkeen and on the already-renamed 457 kcal row. Three independent
-- numbers agreeing is what makes this a correction and not a guess.
--
-- The `kcal_per_100g < 300` guard is load-bearing: migrations here are applied
-- by hand, and without it a second paste would rescale an already-correct row
-- a second time.

UPDATE foods
SET name               = 'Moong Dal Namkeen',
    kcal_per_100g      = round((kcal_per_100g      * 100.0 / serving_size_g)::numeric, 1),
    protein_g_per_100g = round((protein_g_per_100g * 100.0 / serving_size_g)::numeric, 1),
    carbs_g_per_100g   = round((carbs_g_per_100g   * 100.0 / serving_size_g)::numeric, 1),
    fat_g_per_100g     = round((fat_g_per_100g     * 100.0 / serving_size_g)::numeric, 1),
    fiber_g_per_100g   = round((fiber_g_per_100g   * 100.0 / serving_size_g)::numeric, 1)
WHERE source_id IN ('off_8904063200136', 'offi_8904063200136')
  AND serving_size_g > 0
  AND kcal_per_100g < 300;   -- idempotence: a second run must not rescale twice


-- ── B. Packets wearing a bare home-dish name ─────────────────────────────────
--
-- Same class as the moong dal namkeen: Open Food Facts stores the name as the
-- label prints it, so a dry mix or a loose-leaf blend sits in the results
-- looking exactly like the cooked dish. Macros are left alone — they are
-- correct *for the dry product*; only the name was lying.

-- offi_8908015703492 — 312 kcal at C59.9. Brewed masala chai is 48
-- (ifct-chai-milk-sugar) / 52 (est-masala-chai). This is the dry blend.
UPDATE foods SET name = 'Masala Chai Blend (Dry)'
WHERE source_id = 'offi_8908015703492';

-- off_0196852616770 — The Cumin Club, serving_description "0.5 pack (50 g)",
-- 434 kcal at C76: a dehydrated instant meal kit, not a cooked plate (~130).
-- off_0011433160513 — Deep, 400 kcal at C72: the same dry mix.
-- Note there is no unbranded "Dal Chawal" row in the catalogue at all, so
-- before this rename these two packets *were* the entire result for one of the
-- most-logged Indian meals.
UPDATE foods SET name = 'Dal Chawal Instant Meal Mix (Dry)'
WHERE source_id IN ('off_0196852616770', 'off_0011433160513');

-- off_0745042001737 — 402 kcal against ifct-rajma-chawal at 142.
UPDATE foods SET name = 'Rajma Chawal Instant Meal Mix (Dry)'
WHERE source_id = 'off_0745042001737';


-- ── C. A curated estimate contradicted by our own measured rows ──────────────
--
-- est-amul-amul-butter — "Amul Butter" [curated] at 125.7 kcal / F7.7, with a
-- serving of "1 cup (200g)". Butter is ~720 and nobody eats a cup of it. The
-- catalogue already holds this product measured twice — ifct-butter
-- "Butter (Amul)" and ifct_amul_butter_salted, both 720 / F80 — and the OFF row
-- off_8901262010320 independently reads 724 / F80. A user logging butter was
-- getting under a sixth of the calories.
--
-- Root cause is scripts/generate-indian-foods-estimate.ts, which categorises
-- this entry `packaged_dairy` — a milk-like baseline applied to a pure fat.
-- The generator is fixed in the same change; this statement corrects the row
-- already sitting in the table, which regenerating cannot reach.

UPDATE foods
SET kcal_per_100g       = 720,
    protein_g_per_100g  = 0.5,
    carbs_g_per_100g    = 0.5,
    fat_g_per_100g      = 80,
    fiber_g_per_100g    = 0,
    serving_size_g      = 10,
    serving_description = '1 tsp (10g)'
WHERE source_id = 'est-amul-amul-butter';

-- est-amul-amul-paneer — the same generator bug, one row down the same list.
-- 160.6 kcal / P14 / F6.6 in a "1 cup (200g)" serving, against the measured
-- ifct-paneer-raw at 265 / 18.3 / 20.8. The protein floor already in the
-- generator rescued this row's protein (4.2 -> 14); nothing rescued its fat, so
-- the calories stayed ~40% low on a food people log by the katori. Aligned to
-- the measured row, serving included — a cup of paneer is not a portion.
UPDATE foods
SET kcal_per_100g       = 265,
    protein_g_per_100g  = 18.3,
    carbs_g_per_100g    = 2.6,
    fat_g_per_100g      = 20.8,
    fiber_g_per_100g    = 0,
    serving_size_g      = 150,
    serving_description = '1 katori (150g)'
WHERE source_id = 'est-amul-amul-paneer';

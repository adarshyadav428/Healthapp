-- 037_name_packaged_moong_dal.sql
--
-- Give the packaged moong dal namkeens a name that says what they are.
--
-- Open Food Facts stores a product's name as the label prints it, and
-- `persistExternalFoods` (app/api/foods/search/route.ts) writes it verbatim. So
-- twelve packets of fried namkeen sat in `foods` under the bare name "Moong
-- Dal" — indistinguishable, in the results list, from home-cooked dal. A user
-- searching for a katori of dal picked one and logged ~476 kcal/100 g instead
-- of ~104.
--
-- Ranking already handles this: `foodIdentity` (lib/searchRanking.ts) scores a
-- branded row as "<brand> <name>", so a packet can no longer take the
-- exact-match tier from the measured IFCT row. This migration is the other
-- half — making the list self-describing rather than merely correctly ordered.
--
-- Keyed on `source_id` (the OFF barcode) rather than a name pattern, so the
-- statement can only touch the rows audited below and cannot drift onto a row
-- added later.
--
-- UPDATE only. Never DELETE from `foods`: food_logs, food_favourites,
-- saved_meal_items and food_dismissals all reference it ON DELETE CASCADE, so
-- one delete silently wipes that food from every user's diary. A rename is
-- safe — logs reference the row by `id` and simply start showing the new name.
--
-- Verified against the live table on 2026-08-22. All ten rows carry the macro
-- signature of a fried besan/moong snack (457-504 kcal, ~21 g protein,
-- ~21 g fat per 100 g), which is what makes "Namkeen" a statement of fact here
-- and not a guess.
--
--   off_8901414000087   Moong Dal   BIKANO       494 kcal  P21.2  F22.5
--   off_8901719130243   Moong Dal   Parle        493 kcal  P21.5  F21.0
--   off_8904004403718   Moong Dal   Haldiram's   476 kcal  P21.3  F20.9
--   off_8904004403725   Moong Dal   Haldiram's   476 kcal  P21.3  F20.9
--   off_8904004403800   Moong dal   Haldiram     476 kcal  P21.3  F20.9
--   off_8906010500559   Mung Dal    Balaji       504 kcal  P22.7  F17.5
--   offi_8904004403718  Moong Dal   Haldiram's   476 kcal  P21.3  F20.9
--   offi_8904004403725  Moong Dal   Haldiram's   476 kcal  P21.3  F20.9
--   offi_8904004403800  Moong dal   Haldiram     476 kcal  P21.3  F20.9
--   offi_8904063240286  Moon daal   Haldiram's   457 kcal  P20.0  F22.9
--
-- The `off_`/`offi_` pairs are the same barcode fetched from the world and the
-- India endpoint; both rows exist because `persistExternalFoods` dedupes on
-- `source_id`, which carries the endpoint prefix. Giving them one name lets
-- `dedupeFoodsByNameBrand` collapse the twins in the response, which is a
-- second, smaller win.
--
-- DELIBERATELY EXCLUDED: off_8904063200136 and offi_8904063200136, both
-- "Moong Dal" / Haldiram's but 160 kcal at P7 F7. That is neither a fried
-- namkeen nor cooked dal, and nothing in the row says what it actually is.
-- Calling it a namkeen would be a guess written into a shared catalogue.
-- `foodIdentity` still ranks them below the measured dal, so they are not
-- urgent — but they need a human to identify them.

UPDATE foods
SET name = 'Moong Dal Namkeen'
WHERE source_id IN (
  'off_8901414000087',
  'off_8901719130243',
  'off_8904004403718',
  'off_8904004403725',
  'off_8904004403800',
  'off_8906010500559',
  'offi_8904004403718',
  'offi_8904004403725',
  'offi_8904004403800',
  'offi_8904063240286'
);

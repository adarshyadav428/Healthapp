-- 041_branded_foods_v2.sql
--
-- A second pass of popular Indian branded/packaged products, in the shape of
-- 018_branded_foods.sql. Source 'branded' — distinct from 'ifct' (measured raw
-- foods), 'curated' (generated estimates) and 'off' (Open Food Facts live).
--
-- WHY: a user searched for "Haldiram's Nut Cracker" and got nothing. The string
-- "nut cracker" did not exist anywhere in the catalogue, while nine other
-- Haldiram's rows did — so the brand looked covered while a top SKU was
-- silently missing. Auditing the rest of the shelf turned up the same hole in
-- a lot of everyday places: Amul Butter had no row at all (only *peanut*
-- butter), and neither did branded atta, soya chunks, popcorn, ketchup,
-- instant coffee, Greek yogurt, frozen fries or the Pepsi family.
--
-- PROVENANCE — read this before trusting a number.
-- These are as-published nutrition-panel values, entered 2026-08-31 from
-- product labels and brand sites. They have NOT been checked against a pack in
-- hand. docs/branded-foods-041-verification.md lists every row for
-- spot-checking, highest-traffic items first. Anything found wrong is fixed by
-- a guarded UPDATE keyed on source_id, in the style of
-- 038_correct_mislabelled_food_rows.sql.
--
-- NEVER DELETE FROM foods. food_logs, food_favourites, saved_meal_items and
-- food_dismissals all reference it ON DELETE CASCADE, so one delete silently
-- wipes that food from every user's diary with no error. An UPDATE is safe:
-- food_logs snapshots its own kcal/macros at log time, so no past diary moves.
--
-- NAMING IS LOAD-BEARING. lib/portion-units.ts picks portions by regex against
-- the *name*, scanned with `.find` (first match wins), and a name match makes
-- buildUnits ignore this table's common_portions entirely. So:
--   * "Nut Cracker" alone matches no rule; "... Namkeen" hits the packaged-snack
--     rule and defaults to a 30 g pack instead of a 200 g katori (scar of 037).
--   * "Masala Peanut" and "Roasted Chana" would hit the CURRY rule — both carry
--     "Namkeen" for the same reason.
--   * the popcorn row is "Classic Salted", never "Butter", or /ghee|butter/
--     would offer it in teaspoons.
--   * Cornetto is "... Ice Cream Cone" so /ice ?cream/ beats /chocolate/.
-- Four portion rules were added in this same change (dairy milk, whey/gainer,
-- Greek yogurt, instant coffee) plus two word-boundary fixes: \blassi\b, which
-- was matching inside "Classic", and \bcola\b, which was matching inside
-- "chocolate" and offering every chocolate row a 250 ml glass. See
-- lib/portion-units.ts and tests/portionUnits.test.ts.
--
-- Idempotent: ON CONFLICT (source, source_id) DO NOTHING. Safe to re-run.

INSERT INTO foods (
  source, source_id, name, brand, serving_size_g, serving_description,
  kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g,
  fiber_g_per_100g, common_portions
)
VALUES

  -- ── NAMKEEN & NUTS ────────────────────────────────────────────────────────
  -- The row this migration exists for.
  ('branded','branded-haldirams-nut-cracker',
   'Haldiram''s Nut Cracker Namkeen', 'Haldiram''s',
   30, '1 serving (30g)',
   586, 20.5, 27.0, 44.0, 5.0,
   '[{"unit":"serving","grams":20,"label":"1 handful (20g)"},{"unit":"serving","grams":30,"label":"Serving (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-haldirams-salted-peanuts',
   'Haldiram''s Salted Peanuts', 'Haldiram''s',
   30, '1 serving (30g)',
   578, 25.8, 16.1, 49.2, 8.0,
   '[{"unit":"serving","grams":20,"label":"1 handful (20g)"},{"unit":"serving","grams":30,"label":"Serving (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-haldirams-masala-peanut',
   'Haldiram''s Masala Peanut Namkeen', 'Haldiram''s',
   30, '1 serving (30g)',
   570, 23.0, 21.0, 45.0, 7.0,
   '[{"unit":"serving","grams":20,"label":"1 handful (20g)"},{"unit":"serving","grams":30,"label":"Serving (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-haldirams-punjabi-tadka',
   'Haldiram''s Punjabi Tadka Namkeen', 'Haldiram''s',
   30, '1 serving (30g)',
   519, 13.0, 48.0, 31.0, 5.0,
   '[{"unit":"serving","grams":20,"label":"1 handful (20g)"},{"unit":"serving","grams":30,"label":"Serving (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-haldirams-golden-mixture',
   'Haldiram''s Golden Mixture Namkeen', 'Haldiram''s',
   30, '1 serving (30g)',
   528, 12.5, 47.0, 33.0, 5.5,
   '[{"unit":"serving","grams":20,"label":"1 handful (20g)"},{"unit":"serving","grams":30,"label":"Serving (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- Roasted, not fried — the one namkeen on this list that is a sane snack.
  ('branded','branded-haldirams-roasted-chana',
   'Haldiram''s Roasted Chana Namkeen', 'Haldiram''s',
   30, '1 serving (30g)',
   380, 22.0, 58.0, 5.5, 15.0,
   '[{"unit":"serving","grams":20,"label":"1 handful (20g)"},{"unit":"serving","grams":30,"label":"Serving (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-bikaji-aloo-bhujia',
   'Bikaji Aloo Bhujia', 'Bikaji',
   30, '1 serving (30g)',
   545, 8.0, 46.0, 37.0, 4.0,
   '[{"unit":"serving","grams":20,"label":"1 handful (20g)"},{"unit":"serving","grams":30,"label":"Serving (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-balaji-masala-wafers',
   'Balaji Wafers Simply Masala', 'Balaji',
   30, '1 pack (30g)',
   540, 6.5, 52.0, 34.0, 3.0,
   '[{"unit":"pack","grams":30,"label":"1 pack (30g)"},{"unit":"pack","grams":60,"label":"Large pack (60g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── CHIPS & POPCORN ───────────────────────────────────────────────────────
  ('branded','branded-lays-cream-onion',
   'Lay''s American Style Cream & Onion Chips', 'Lay''s',
   26, '1 small pack (26g)',
   549, 6.5, 51.0, 35.0, 1.5,
   '[{"unit":"pack","grams":26,"label":"Small pack (26g)"},{"unit":"pack","grams":52,"label":"Large pack (52g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-bingo-chilli-sprinkled',
   'Bingo Original Style Chilli Sprinkled Chips', 'Bingo',
   26, '1 small pack (26g)',
   542, 6.0, 52.0, 34.0, 1.5,
   '[{"unit":"pack","grams":26,"label":"Small pack (26g)"},{"unit":"pack","grams":52,"label":"Large pack (52g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-kurkure-green-chutney',
   'Kurkure Green Chutney Rajasthani Style', 'Kurkure',
   30, '1 pack (30g)',
   552, 6.5, 54.0, 34.0, 2.0,
   '[{"unit":"pack","grams":30,"label":"1 pack (30g)"},{"unit":"pack","grams":60,"label":"Large pack (60g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- "Classic Salted", never "Butter" — /ghee|butter/ would offer teaspoons.
  ('branded','branded-act-ii-popcorn',
   'Act II Classic Salted Popcorn (Popped)', 'Act II',
   30, '1 bowl (30g)',
   500, 8.0, 55.0, 27.0, 9.0,
   '[{"unit":"bowl","grams":30,"label":"1 bowl (30g)"},{"unit":"bowl","grams":60,"label":"Large bowl (60g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-haldirams-makhana-peri-peri',
   'Haldiram''s Roasted Makhana (Peri Peri)', 'Haldiram''s',
   25, '1 serving (25g)',
   430, 9.5, 68.0, 13.0, 8.0,
   '[{"unit":"serving","grams":25,"label":"Serving (25g)"},{"unit":"serving","grams":50,"label":"2 servings (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── BISCUITS ──────────────────────────────────────────────────────────────
  ('branded','branded-parle-hide-seek',
   'Parle Hide & Seek Chocolate Chip Biscuits', 'Parle',
   25, '3 biscuits (25g)',
   501, 6.0, 66.0, 23.5, 1.5,
   '[{"unit":"biscuit","grams":8,"label":"1 biscuit (8g)"},{"unit":"biscuit","grams":25,"label":"3 biscuits (25g)"},{"unit":"biscuit","grams":50,"label":"6 biscuits (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-britannia-tiger-krunch',
   'Britannia Tiger Krunch Chocochip Biscuits', 'Britannia',
   25, '3 biscuits (25g)',
   480, 6.5, 69.0, 20.0, 1.5,
   '[{"unit":"biscuit","grams":8,"label":"1 biscuit (8g)"},{"unit":"biscuit","grams":25,"label":"3 biscuits (25g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-sunfeast-bounce',
   'Sunfeast Bounce Elaichi Cream Biscuits', 'Sunfeast',
   25, '2 biscuits (25g)',
   500, 5.0, 68.0, 23.0, 1.0,
   '[{"unit":"biscuit","grams":12,"label":"1 biscuit (12g)"},{"unit":"biscuit","grams":25,"label":"2 biscuits (25g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-unibic-choco-chip',
   'Unibic Choco Chip Cookies', 'Unibic',
   25, '2 cookies (25g)',
   490, 6.0, 64.0, 23.0, 2.0,
   '[{"unit":"cookie","grams":12,"label":"1 cookie (12g)"},{"unit":"cookie","grams":25,"label":"2 cookies (25g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── DAIRY & SPREADS ───────────────────────────────────────────────────────
  -- No branded paneer row: 'Paneer' is already measured IFCT data (rank 6,
  -- above 'branded'), and /paneer/ in portion-units.ts is the cooked-sabzi
  -- katori — it would default a 50 g pack serving of raw paneer to 150 g.
  -- The single biggest gap in the catalogue: no butter row existed at all.
  ('branded','branded-amul-butter',
   'Amul Butter (Pasteurised)', 'Amul',
   10, '1 tbsp (10g)',
   720, 0.5, 0.4, 80.0, 0.0,
   '[{"unit":"teaspoon","grams":5,"label":"1 tsp (5g)"},{"unit":"tablespoon","grams":10,"label":"1 tbsp (10g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-amul-ghee',
   'Amul Pure Cow Ghee', 'Amul',
   10, '1 tbsp (10g)',
   900, 0.0, 0.0, 100.0, 0.0,
   '[{"unit":"teaspoon","grams":5,"label":"1 tsp (5g)"},{"unit":"tablespoon","grams":14,"label":"1 tbsp (14g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-epigamia-greek-yogurt',
   'Epigamia Greek Yogurt (Natural)', 'Epigamia',
   90, '1 cup (90g)',
   76, 8.5, 5.0, 2.8, 0.0,
   '[{"unit":"cup","grams":90,"label":"1 cup (90g)"},{"unit":"cup","grams":180,"label":"2 cups (180g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-nestle-everyday',
   'Nestlé Everyday Dairy Whitener', 'Nestlé',
   12, '2 tsp (12g)',
   496, 25.0, 38.0, 26.5, 0.0,
   '[{"unit":"teaspoon","grams":6,"label":"1 tsp (6g)"},{"unit":"teaspoon","grams":12,"label":"2 tsp (12g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── STAPLES & FLOUR ───────────────────────────────────────────────────────
  -- Raw flour, per roti's worth of atta. No name pattern matches these, so the
  -- common_portions below are what the picker actually shows.
  ('branded','branded-aashirvaad-atta',
   'Aashirvaad Whole Wheat Atta (Raw)', 'Aashirvaad',
   30, '1 roti worth (30g)',
   341, 12.0, 69.0, 1.5, 11.0,
   '[{"unit":"serving","grams":30,"label":"1 roti worth (30g)"},{"unit":"cup","grams":120,"label":"1 cup dry (120g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-pillsbury-atta',
   'Pillsbury Chakki Fresh Atta (Raw)', 'Pillsbury',
   30, '1 roti worth (30g)',
   340, 11.5, 70.0, 1.5, 10.5,
   '[{"unit":"serving","grams":30,"label":"1 roti worth (30g)"},{"unit":"cup","grams":120,"label":"1 cup dry (120g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-nutrela-soya-chunks',
   'Nutrela Soya Chunks (Raw)', 'Nutrela',
   30, '1 serving dry (30g)',
   345, 52.0, 33.0, 0.5, 13.0,
   '[{"unit":"serving","grams":30,"label":"Serving dry (30g)"},{"unit":"cup","grams":50,"label":"½ cup dry (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-fortune-besan',
   'Fortune Besan (Gram Flour, Raw)', 'Fortune',
   30, '1 serving (30g)',
   387, 22.0, 58.0, 6.7, 11.0,
   '[{"unit":"tablespoon","grams":15,"label":"1 tbsp (15g)"},{"unit":"serving","grams":30,"label":"Serving (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── FROZEN & READY ────────────────────────────────────────────────────────
  -- Values as sold (frozen, before frying) — deep-frying adds oil on top.
  ('branded','branded-mccain-french-fries',
   'McCain French Fries (Frozen)', 'McCain',
   85, '1 serving (85g)',
   168, 2.5, 24.0, 6.5, 2.5,
   '[{"unit":"serving","grams":85,"label":"Serving (85g)"},{"unit":"serving","grams":150,"label":"Large serving (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-mccain-potato-smiles',
   'McCain Potato Smiles (Frozen)', 'McCain',
   85, '1 serving (85g)',
   190, 2.5, 26.0, 8.0, 2.5,
   '[{"unit":"serving","grams":85,"label":"Serving (85g)"},{"unit":"serving","grams":150,"label":"Large serving (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-id-malabar-parota',
   'ID Fresh Malabar Parota', 'ID Fresh',
   62, '1 parota (62g)',
   320, 7.0, 45.0, 12.0, 2.0,
   '[{"unit":"piece","grams":62,"label":"1 parota (62g)"},{"unit":"piece","grams":124,"label":"2 parotas (124g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── CONDIMENTS ────────────────────────────────────────────────────────────
  ('branded','branded-kissan-ketchup',
   'Kissan Fresh Tomato Ketchup', 'Kissan',
   15, '1 tbsp (15g)',
   108, 0.9, 25.5, 0.1, 0.5,
   '[{"unit":"teaspoon","grams":5,"label":"1 tsp (5g)"},{"unit":"tablespoon","grams":15,"label":"1 tbsp (15g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-veeba-mayonnaise',
   'Veeba Real Mayonnaise', 'Veeba',
   15, '1 tbsp (15g)',
   680, 1.0, 4.0, 73.0, 0.0,
   '[{"unit":"teaspoon","grams":5,"label":"1 tsp (5g)"},{"unit":"tablespoon","grams":15,"label":"1 tbsp (15g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── BEVERAGES ─────────────────────────────────────────────────────────────
  ('branded','branded-pepsi',
   'Pepsi', 'Pepsi',
   250, '1 glass (250ml)',
   44, 0.0, 11.0, 0.0, 0.0,
   '[{"unit":"glass","grams":250,"label":"1 glass (250ml)"},{"unit":"can","grams":300,"label":"1 can (300ml)"},{"unit":"bottle","grams":600,"label":"1 bottle (600ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('branded','branded-mountain-dew',
   'Mountain Dew', 'Mountain Dew',
   250, '1 glass (250ml)',
   51, 0.0, 13.0, 0.0, 0.0,
   '[{"unit":"glass","grams":250,"label":"1 glass (250ml)"},{"unit":"can","grams":300,"label":"1 can (300ml)"},{"unit":"bottle","grams":600,"label":"1 bottle (600ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('branded','branded-7up',
   '7Up Lemon Soft Drink', '7Up',
   250, '1 glass (250ml)',
   40, 0.0, 10.0, 0.0, 0.0,
   '[{"unit":"glass","grams":250,"label":"1 glass (250ml)"},{"unit":"can","grams":300,"label":"1 can (300ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('branded','branded-mirinda',
   'Mirinda Orange Soft Drink', 'Mirinda',
   250, '1 glass (250ml)',
   54, 0.0, 13.5, 0.0, 0.0,
   '[{"unit":"glass","grams":250,"label":"1 glass (250ml)"},{"unit":"can","grams":300,"label":"1 can (300ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('branded','branded-sting-energy',
   'Sting Energy Drink', 'Sting',
   250, '1 bottle (250ml)',
   48, 0.0, 12.0, 0.0, 0.0,
   '[{"unit":"bottle","grams":250,"label":"1 bottle (250ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('branded','branded-tropicana-orange',
   'Tropicana 100% Orange Juice', 'Tropicana',
   200, '1 glass (200ml)',
   45, 0.5, 10.5, 0.0, 0.2,
   '[{"unit":"glass","grams":200,"label":"1 glass (200ml)"},{"unit":"glass","grams":300,"label":"Large glass (300ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  -- Powder, not a brewed cup — see the instant-coffee rule in portion-units.ts.
  ('branded','branded-nescafe-classic',
   'Nescafé Classic Instant Coffee (Powder)', 'Nescafé',
   2, '1 tsp (2g)',
   353, 12.2, 75.0, 0.5, 0.0,
   '[{"unit":"teaspoon","grams":2,"label":"1 tsp (2g)"},{"unit":"teaspoon","grams":4,"label":"2 tsp (4g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-bru-instant-coffee',
   'Bru Instant Coffee (Powder)', 'Bru',
   2, '1 tsp (2g)',
   350, 8.0, 80.0, 0.5, 0.0,
   '[{"unit":"teaspoon","grams":2,"label":"1 tsp (2g)"},{"unit":"teaspoon","grams":4,"label":"2 tsp (4g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── SWEETS & DESSERTS ─────────────────────────────────────────────────────
  ('branded','branded-haldirams-soan-papdi',
   'Haldiram''s Soan Papdi', 'Haldiram''s',
   25, '1 piece (25g)',
   540, 5.0, 60.0, 31.0, 1.0,
   '[{"unit":"piece","grams":25,"label":"1 piece (25g)"},{"unit":"piece","grams":50,"label":"2 pieces (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-haldirams-rasgulla',
   'Haldiram''s Rasgulla (Tin)', 'Haldiram''s',
   45, '1 piece with syrup (45g)',
   186, 2.5, 40.0, 1.5, 0.0,
   '[{"unit":"piece","grams":45,"label":"1 piece (45g)"},{"unit":"piece","grams":90,"label":"2 pieces (90g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- "Ice Cream Cone" in the name on purpose: /ice ?cream/ must win over
  -- /chocolate/, or this is offered as half a chocolate bar.
  ('branded','branded-cornetto-chocolate',
   'Kwality Wall''s Cornetto Ice Cream Cone (Chocolate)', 'Kwality Wall''s',
   70, '1 cone (70g)',
   290, 4.0, 36.0, 14.0, 0.5,
   '[{"unit":"cone","grams":70,"label":"1 cone (70g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-cadbury-silk',
   'Cadbury Dairy Milk Silk', 'Cadbury',
   60, '1 bar (60g)',
   555, 7.5, 57.0, 32.5, 0.5,
   '[{"unit":"square","grams":12,"label":"2 squares (12g)"},{"unit":"bar","grams":60,"label":"1 bar (60g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-cadbury-perk',
   'Cadbury Perk Chocolate', 'Cadbury',
   13, '1 bar (13g)',
   530, 6.0, 62.0, 28.0, 0.5,
   '[{"unit":"bar","grams":13,"label":"1 bar (13g)"},{"unit":"bar","grams":26,"label":"2 bars (26g)"},{"unit":"gram","grams":100,"label":"100g"}]')

ON CONFLICT (source, source_id) DO NOTHING;

-- 016_missing_foods.sql
-- Seeds 52 foods present in indian-foods-data.ts but absent from migrations 007–015.
-- Root cause: auto-seed in search route was blocked because migration count (240)
-- already exceeded INDIAN_FOODS.length (225), preventing upserts from ever running.
-- Idempotent: ON CONFLICT (source, source_id) DO NOTHING.

INSERT INTO foods (
  source, source_id, name, brand, serving_size_g, serving_description,
  kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g,
  fiber_g_per_100g, common_portions
)
VALUES

  -- ── RAW VEGETABLES ───────────────────────────────────────────────────────────
  ('ifct', 'ifct-tomato',       'Tomato (Tamatar)',                    NULL,     120, '1 medium tomato (120g)',         20,   0.9,  3.9,  0.2,  1.2,
   '[{"unit":"small","grams":80,"label":"1 small tomato (80g)"},{"unit":"medium","grams":120,"label":"1 medium tomato (120g)"},{"unit":"large","grams":150,"label":"1 large tomato (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-onion',        'Onion (Pyaaz)',                       NULL,     100, '1 medium onion (100g)',          40,   1.1,  8.6,  0.1,  1.7,
   '[{"unit":"small","grams":70,"label":"1 small onion (70g)"},{"unit":"medium","grams":100,"label":"1 medium onion (100g)"},{"unit":"large","grams":150,"label":"1 large onion (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-garlic',       'Garlic (Lahsun)',                     NULL,      10, '3–4 cloves (10g)',              149,   6.4, 33.1,  0.5,  2.1,
   '[{"unit":"clove","grams":3,"label":"1 clove (3g)"},{"unit":"bulb","grams":10,"label":"3-4 cloves (10g)"},{"unit":"tablespoon","grams":15,"label":"1 tbsp minced (15g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-ginger',       'Ginger (Adrak)',                      NULL,      10, '1 inch piece (10g)',             80,   1.8, 17.8,  0.8,  2.0,
   '[{"unit":"piece","grams":10,"label":"1 inch piece (10g)"},{"unit":"tablespoon","grams":15,"label":"1 tbsp grated (15g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-carrot',       'Carrot (Gajar)',                      NULL,      80, '1 medium carrot (80g)',          48,   0.9, 10.6,  0.2,  2.8,
   '[{"unit":"small","grams":60,"label":"1 small carrot (60g)"},{"unit":"medium","grams":80,"label":"1 medium carrot (80g)"},{"unit":"large","grams":120,"label":"1 large carrot (120g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-cucumber',     'Cucumber (Kheera)',                   NULL,     150, '½ cucumber (150g)',              16,   0.7,  2.5,  0.1,  0.7,
   '[{"unit":"half","grams":150,"label":"½ cucumber (150g)"},{"unit":"whole","grams":300,"label":"1 whole cucumber (300g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-cabbage',      'Cabbage (Patta Gobi)',                NULL,     100, '1 katori chopped (100g)',        25,   1.3,  4.7,  0.1,  2.5,
   '[{"unit":"katori","grams":100,"label":"1 katori chopped (100g)"},{"unit":"half","grams":200,"label":"½ small head (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-beetroot',     'Beetroot (Chukandar)',                NULL,      80, '½ medium beet (80g)',            43,   1.6,  9.6,  0.1,  2.8,
   '[{"unit":"small","grams":80,"label":"½ medium beet (80g)"},{"unit":"medium","grams":150,"label":"1 medium beet (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-radish',       'Radish (Mooli)',                      NULL,     100, '1 medium mooli (100g)',          17,   0.7,  3.4,  0.1,  1.6,
   '[{"unit":"small","grams":80,"label":"1 small mooli (80g)"},{"unit":"medium","grams":100,"label":"1 medium mooli (100g)"},{"unit":"large","grams":200,"label":"1 large mooli (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-sweet-potato', 'Sweet Potato (Shakarkand)',           NULL,     130, '1 medium (130g)',                86,   1.6, 20.1,  0.1,  3.0,
   '[{"unit":"small","grams":100,"label":"1 small (100g)"},{"unit":"medium","grams":130,"label":"1 medium (130g)"},{"unit":"large","grams":200,"label":"1 large (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-corn',         'Sweet Corn (Makkai)',                 NULL,     100, '½ cup kernels (100g)',           86,   3.3, 19.0,  1.4,  2.4,
   '[{"unit":"cob","grams":150,"label":"1 corn cob (150g)"},{"unit":"katori","grams":100,"label":"½ cup kernels (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-spinach-raw',  'Spinach Raw (Palak)',                 NULL,     100, '1 katori leaves (100g)',         23,   2.9,  3.6,  0.4,  2.2,
   '[{"unit":"katori","grams":50,"label":"Small katori (50g)"},{"unit":"katori","grams":100,"label":"Katori (100g)"},{"unit":"bunch","grams":200,"label":"1 bunch (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-drumstick',    'Drumstick / Moringa (Sahjan)',        NULL,     100, '2–3 pieces (100g)',              37,   2.1,  8.5,  0.2,  3.2,
   '[{"unit":"piece","grams":50,"label":"2-3 sticks (50g)"},{"unit":"piece","grams":100,"label":"4-5 sticks (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── FRUITS ───────────────────────────────────────────────────────────────────
  ('ifct', 'ifct-apple',        'Apple (Seb)',                         NULL,     150, '1 medium apple (150g)',          59,   0.3, 14.0,  0.4,  2.4,
   '[{"unit":"small","grams":120,"label":"1 small apple (120g)"},{"unit":"medium","grams":150,"label":"1 medium apple (150g)"},{"unit":"large","grams":200,"label":"1 large apple (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-orange',       'Orange (Santra / Narangi)',           NULL,     130, '1 medium orange (130g)',         48,   0.9, 11.2,  0.1,  2.4,
   '[{"unit":"small","grams":100,"label":"1 small orange (100g)"},{"unit":"medium","grams":130,"label":"1 medium orange (130g)"},{"unit":"large","grams":180,"label":"1 large orange (180g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-grapes',       'Grapes (Angoor)',                     NULL,     100, '1 small bunch (100g)',           71,   0.6, 17.2,  0.4,  0.9,
   '[{"unit":"handful","grams":80,"label":"Small handful (80g)"},{"unit":"bunch","grams":100,"label":"1 bunch (100g)"},{"unit":"bunch","grams":200,"label":"Large bunch (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-pear',         'Pear (Nashpati)',                     NULL,     150, '1 medium pear (150g)',           57,   0.4, 13.9,  0.1,  3.1,
   '[{"unit":"small","grams":120,"label":"1 small pear (120g)"},{"unit":"medium","grams":150,"label":"1 medium pear (150g)"},{"unit":"large","grams":200,"label":"1 large pear (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-strawberry',   'Strawberry',                         NULL,     100, '6–8 strawberries (100g)',        32,   0.7,  7.7,  0.3,  2.0,
   '[{"unit":"piece","grams":12,"label":"1 strawberry (12g)"},{"unit":"handful","grams":100,"label":"6-8 berries (100g)"},{"unit":"cup","grams":150,"label":"1 cup (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── GRAINS & CEREALS ─────────────────────────────────────────────────────────
  ('ifct', 'ifct-oats-rolled',  'Rolled Oats (Raw)',                   NULL,      40, '½ cup dry oats (40g)',          380,  13.2, 66.3,  6.9, 10.1,
   '[{"unit":"serving","grams":40,"label":"½ cup dry (40g)"},{"unit":"serving","grams":80,"label":"1 cup dry (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-oats-cooked',  'Cooked Oatmeal / Daliya Oats',       NULL,     240, '1 bowl cooked (240g)',           71,   2.5, 12.0,  1.5,  1.7,
   '[{"unit":"bowl","grams":180,"label":"Small bowl (180g)"},{"unit":"bowl","grams":240,"label":"Bowl (240g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-daliya',       'Daliya / Broken Wheat Porridge (Cooked)', NULL, 200, '1 bowl cooked (200g)',          75,   2.8, 15.5,  0.5,  2.2,
   '[{"unit":"bowl","grams":150,"label":"Small bowl (150g)"},{"unit":"bowl","grams":200,"label":"Bowl (200g)"},{"unit":"bowl","grams":300,"label":"Large bowl (300g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-bread-white',  'White Bread (Slice)',                 NULL,      25, '1 slice (25g)',                 265,   9.0, 50.6,  3.2,  2.7,
   '[{"unit":"slice","grams":25,"label":"1 slice (25g)"},{"unit":"slice","grams":50,"label":"2 slices (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-bread-brown',  'Brown / Whole Wheat Bread (Slice)',   NULL,      25, '1 slice (25g)',                 243,   8.5, 45.0,  3.5,  6.0,
   '[{"unit":"slice","grams":25,"label":"1 slice (25g)"},{"unit":"slice","grams":50,"label":"2 slices (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-cornflakes',   'Cornflakes',                          NULL,      30, '1 bowl (30g)',                  357,   7.5, 84.0,  0.5,  1.2,
   '[{"unit":"bowl","grams":30,"label":"1 bowl dry (30g)"},{"unit":"bowl","grams":60,"label":"2 bowls dry (60g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-suji-raw',     'Suji / Semolina (Rava) — Raw',       NULL,      30, '2 tbsp (30g)',                  349,  10.4, 73.0,  0.8,  1.5,
   '[{"unit":"tablespoon","grams":15,"label":"1 tbsp (15g)"},{"unit":"tablespoon","grams":30,"label":"2 tbsp (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-sattu',        'Sattu (Roasted Gram Flour)',          NULL,      30, '2 tbsp (30g)',                  406,  20.6, 65.2,  6.9,  4.5,
   '[{"unit":"tablespoon","grams":15,"label":"1 tbsp (15g)"},{"unit":"tablespoon","grams":30,"label":"2 tbsp (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── PROTEINS ─────────────────────────────────────────────────────────────────
  ('ifct', 'ifct-egg-white',           'Egg White (Anda Safeda)',             NULL,  33, '1 egg white (33g)',              52,  10.9,  0.7,  0.2, NULL,
   '[{"unit":"piece","grams":33,"label":"1 egg white (33g)"},{"unit":"piece","grams":66,"label":"2 egg whites (66g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-chicken-breast-raw',  'Chicken Breast (Raw)',                NULL, 150, '1 piece raw (150g)',            120,  22.5,  0.0,  2.6, NULL,
   '[{"unit":"piece","grams":100,"label":"Small piece (100g)"},{"unit":"piece","grams":150,"label":"Medium piece (150g)"},{"unit":"piece","grams":200,"label":"Large piece (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-chicken-breast-cooked', 'Chicken Breast Cooked (Grilled/Boiled)', NULL, 120, '1 piece cooked (120g)', 165,  31.0,  0.0,  3.6, NULL,
   '[{"unit":"piece","grams":100,"label":"Small piece (100g)"},{"unit":"piece","grams":120,"label":"Medium piece (120g)"},{"unit":"piece","grams":180,"label":"Large piece (180g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-tuna-canned',          'Tuna (Canned in Water)',              NULL,  85, '½ can (85g)',                   116,  25.5,  0.0,  1.0, NULL,
   '[{"unit":"can","grams":85,"label":"½ can (85g)"},{"unit":"can","grams":170,"label":"1 can (170g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── DAIRY & FATS ─────────────────────────────────────────────────────────────
  ('ifct', 'ifct-milk-skimmed',  'Skimmed Milk (Toned Milk)',          NULL,     200, '1 glass (200ml)',                35,   3.4,  5.0,  0.1, NULL,
   '[{"unit":"glass","grams":200,"label":"1 glass (200ml)"},{"unit":"glass","grams":300,"label":"1 large glass (300ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('ifct', 'ifct-soya-milk',     'Soya Milk (Unsweetened)',            NULL,     200, '1 glass (200ml)',                43,   3.5,  2.5,  2.2,  0.6,
   '[{"unit":"glass","grams":200,"label":"1 glass (200ml)"},{"unit":"glass","grams":300,"label":"1 large glass (300ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('ifct', 'ifct-sunflower-oil', 'Sunflower Oil (Refined)',            NULL,      10, '1 tsp (10ml)',                  900,   0.0,  0.0,100.0, NULL,
   '[{"unit":"teaspoon","grams":5,"label":"½ tsp (5ml)"},{"unit":"teaspoon","grams":10,"label":"1 tsp (10ml)"},{"unit":"tablespoon","grams":15,"label":"1 tbsp (15ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('ifct', 'ifct-groundnut-oil', 'Groundnut Oil / Peanut Oil',         NULL,      10, '1 tsp (10ml)',                  900,   0.0,  0.0,100.0, NULL,
   '[{"unit":"teaspoon","grams":5,"label":"½ tsp (5ml)"},{"unit":"teaspoon","grams":10,"label":"1 tsp (10ml)"},{"unit":"tablespoon","grams":15,"label":"1 tbsp (15ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('ifct', 'ifct-peanut-butter', 'Peanut Butter',                      NULL,      32, '2 tbsp (32g)',                  598,  25.1, 20.0, 50.4,  6.0,
   '[{"unit":"tablespoon","grams":16,"label":"1 tbsp (16g)"},{"unit":"tablespoon","grams":32,"label":"2 tbsp (32g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── PACKAGED HEALTH FOODS ────────────────────────────────────────────────────
  ('ifct', 'ifct-whey-protein',  'Whey Protein Powder (Generic)',      NULL,      30, '1 scoop (30g)',                 380,  80.0,  8.0,  5.0, NULL,
   '[{"unit":"scoop","grams":30,"label":"1 scoop (30g)"},{"unit":"scoop","grams":60,"label":"2 scoops (60g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-pappadum',      'Pappadum / Papad (Raw)',             NULL,      10, '1 piece raw (10g)',             347,  26.0, 59.0,  1.0,  5.8,
   '[{"unit":"piece","grams":10,"label":"1 piece (10g)"},{"unit":"piece","grams":20,"label":"2 pieces (20g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-mixed-pickle',  'Mixed Pickle / Achar',               NULL,      20, '1 tbsp (20g)',                  110,   1.5,  5.0,  9.5,  2.0,
   '[{"unit":"teaspoon","grams":10,"label":"1 tsp (10g)"},{"unit":"tablespoon","grams":20,"label":"1 tbsp (20g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-horlicks',      'Horlicks (Original)',                'GSK',     27, '3 tsp / 1 serving (27g)',       379,  12.0, 74.0,  5.0,  1.5,
   '[{"unit":"serving","grams":27,"label":"1 serving (27g)"},{"unit":"serving","grams":54,"label":"2 servings (54g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-bournvita',     'Bournvita',                          'Cadbury', 20, '2 tsp (20g)',                   389,   7.5, 85.0,  2.5,  1.0,
   '[{"unit":"teaspoon","grams":10,"label":"1 tsp (10g)"},{"unit":"tablespoon","grams":20,"label":"2 tsp (20g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── ADDITIONAL COMMON DISHES ─────────────────────────────────────────────────
  ('ifct', 'ifct-aloo-choka',         'Aloo Choka / Chokha (Spiced Mashed Potato)', NULL, 100, '1 bowl (100g)',  118,   2.0, 19.0,  4.0,  2.0,
   '[{"unit":"katori","grams":100,"label":"Katori (100g)"},{"unit":"katori","grams":150,"label":"Large katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-kadhi-pakora',       'Kadhi Pakora',                           NULL, 200, '1 katori with pakoras (200g)', 97, 3.8, 8.8, 5.4, 0.8,
   '[{"unit":"katori","grams":150,"label":"Small katori (150g)"},{"unit":"katori","grams":200,"label":"Katori (200g)"},{"unit":"katori","grams":300,"label":"Large katori (300g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-egg-curry',          'Egg Curry (Anda Curry)',                  NULL, 150, '2 eggs with gravy (150g)',    125,   8.5,  5.2,  8.8,  0.5,
   '[{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"katori","grams":200,"label":"Large katori (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-jeera-rice',         'Jeera Rice (Cumin Rice)',                 NULL, 180, '1 katori (180g)',             148,   2.8, 29.2,  3.0,  0.4,
   '[{"unit":"katori","grams":150,"label":"Small katori (150g)"},{"unit":"katori","grams":180,"label":"Katori (180g)"},{"unit":"katori","grams":250,"label":"Large katori (250g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-chicken-tikka',      'Chicken Tikka (Grilled)',                 NULL, 100, '4–5 pieces (100g)',           172,  23.0,  4.5,  7.0,  0.5,
   '[{"unit":"piece","grams":25,"label":"1 piece (25g)"},{"unit":"serving","grams":100,"label":"4-5 pieces (100g)"},{"unit":"serving","grams":150,"label":"6-7 pieces (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-seekh-kebab-chicken','Chicken Seekh Kebab',                     NULL,  80, '2 kebabs (80g)',              192,  19.0,  6.5, 11.0,  0.8,
   '[{"unit":"piece","grams":40,"label":"1 kebab (40g)"},{"unit":"piece","grams":80,"label":"2 kebabs (80g)"},{"unit":"piece","grams":120,"label":"3 kebabs (120g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-dum-aloo',           'Dum Aloo (Aloo Dum)',                     NULL, 150, '1 katori (150g)',             138,   2.5, 16.0,  7.5,  2.2,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"katori","grams":225,"label":"Large katori (225g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-keema-matar',        'Keema Matar (Minced Meat with Peas)',     NULL, 150, '1 katori (150g)',             188,  18.0,  6.0, 10.5,  1.5,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"katori","grams":225,"label":"Large katori (225g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-mixed-veg-curry',    'Mixed Vegetable Curry (Sabzi)',           NULL, 150, '1 katori (150g)',              72,   2.2,  8.0,  3.8,  2.2,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"katori","grams":225,"label":"Large katori (225g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-veg-fried-rice',     'Veg Fried Rice (Indian Chinese)',         NULL, 200, '1 plate (200g)',              168,   3.8, 30.0,  4.2,  1.2,
   '[{"unit":"plate","grams":150,"label":"Small plate (150g)"},{"unit":"plate","grams":200,"label":"Plate (200g)"},{"unit":"plate","grams":300,"label":"Large plate (300g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-mutton-seekh-kebab', 'Mutton Seekh Kebab',                      NULL,  80, '2 kebabs (80g)',              225,  18.5,  5.0, 15.0,  0.5,
   '[{"unit":"piece","grams":40,"label":"1 kebab (40g)"},{"unit":"piece","grams":80,"label":"2 kebabs (80g)"},{"unit":"piece","grams":120,"label":"3 kebabs (120g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-sambar-rice',        'Sambar Rice (Combo)',                     NULL, 300, '1 plate rice + sambar (300g)',110,   3.5, 22.0,  1.2,  1.0,
   '[{"unit":"plate","grams":250,"label":"Small plate (250g)"},{"unit":"plate","grams":300,"label":"Plate (300g)"},{"unit":"plate","grams":400,"label":"Large plate (400g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-idli-sambar',        'Idli Sambar (2 idlis + sambar)',          NULL, 280, '2 idlis + 1 bowl sambar (280g)', 85, 3.2, 16.0, 1.0, 1.2,
   '[{"unit":"serving","grams":200,"label":"2 idli + small sambar (200g)"},{"unit":"serving","grams":280,"label":"2 idli + sambar (280g)"},{"unit":"serving","grams":400,"label":"3 idli + sambar (400g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-aloo-matar',         'Aloo Matar (Potato & Peas Curry)',        NULL, 150, '1 katori (150g)',             105,   3.5, 14.5,  4.0,  2.5,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"katori","grams":225,"label":"Large katori (225g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct', 'ifct-rajma-chawal',       'Rajma Chawal (Kidney Beans & Rice)',      NULL, 350, '1 plate (350g)',              142,   6.5, 25.5,  2.2,  3.0,
   '[{"unit":"plate","grams":300,"label":"Small plate (300g)"},{"unit":"plate","grams":350,"label":"Plate (350g)"},{"unit":"plate","grams":450,"label":"Large plate (450g)"},{"unit":"gram","grams":100,"label":"100g"}]')

ON CONFLICT (source, source_id) DO NOTHING;

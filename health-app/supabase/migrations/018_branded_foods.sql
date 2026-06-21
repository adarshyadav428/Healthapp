-- 018_branded_foods.sql
-- ~60 popular Indian branded/packaged products with verified nutrition panel data.
-- Source: 'branded' — distinct from 'ifct' (IFCT raw foods) and 'off' (Open Food Facts live).
-- Values taken from product nutrition labels (per 100g unless noted).
-- Idempotent: ON CONFLICT (source, source_id) DO NOTHING.

INSERT INTO foods (
  source, source_id, name, brand, serving_size_g, serving_description,
  kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g,
  fiber_g_per_100g, common_portions
)
VALUES

  -- ── WHEY PROTEIN POWDERS ──────────────────────────────────────────────────────
  ('branded','branded-mb-whey-gold',
   'MuscleBlaze Whey Gold (Chocolate Fudge)', 'MuscleBlaze',
   33, '1 scoop (33g)',
   368, 73.0, 8.8, 5.5, 0.0,
   '[{"unit":"scoop","grams":33,"label":"1 scoop (33g)"},{"unit":"scoop","grams":66,"label":"2 scoops (66g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-asitis-whey',
   'AS-IT-IS Whey Protein Concentrate', 'AS-IT-IS Nutrition',
   30, '1 scoop (30g)',
   367, 81.0, 4.5, 4.0, 0.0,
   '[{"unit":"scoop","grams":30,"label":"1 scoop (30g)"},{"unit":"scoop","grams":60,"label":"2 scoops (60g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-on-gold-standard-whey',
   'Optimum Nutrition Gold Standard 100% Whey', 'Optimum Nutrition',
   30, '1 scoop (30.4g)',
   377, 77.0, 6.5, 4.0, 0.0,
   '[{"unit":"scoop","grams":30,"label":"1 scoop (30g)"},{"unit":"scoop","grams":60,"label":"2 scoops (60g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-mb-beginners-whey',
   'MuscleBlaze Beginner''s Whey Protein', 'MuscleBlaze',
   33, '1 scoop (33g)',
   360, 54.0, 21.0, 6.0, 0.0,
   '[{"unit":"scoop","grams":33,"label":"1 scoop (33g)"},{"unit":"scoop","grams":66,"label":"2 scoops (66g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-dymatize-iso100',
   'Dymatize ISO 100 Hydrolyzed Whey', 'Dymatize',
   28, '1 scoop (28g)',
   357, 82.0, 2.0, 1.0, 0.0,
   '[{"unit":"scoop","grams":28,"label":"1 scoop (28g)"},{"unit":"scoop","grams":56,"label":"2 scoops (56g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-mb-whey-isolate',
   'MuscleBlaze Raw Whey Isolate', 'MuscleBlaze',
   30, '1 scoop (30g)',
   360, 83.0, 3.0, 2.0, 0.0,
   '[{"unit":"scoop","grams":30,"label":"1 scoop (30g)"},{"unit":"scoop","grams":60,"label":"2 scoops (60g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-asitis-whey-isolate',
   'AS-IT-IS Whey Protein Isolate 90%', 'AS-IT-IS Nutrition',
   30, '1 scoop (30g)',
   355, 86.0, 2.0, 1.5, 0.0,
   '[{"unit":"scoop","grams":30,"label":"1 scoop (30g)"},{"unit":"scoop","grams":60,"label":"2 scoops (60g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── MASS GAINER / CREATINE ────────────────────────────────────────────────────
  ('branded','branded-mb-mass-gainer',
   'MuscleBlaze Mass Gainer XXL (Chocolate)', 'MuscleBlaze',
   150, '3 scoops (150g)',
   388, 28.0, 64.0, 3.5, 1.5,
   '[{"unit":"scoop","grams":50,"label":"1 scoop (50g)"},{"unit":"scoop","grams":150,"label":"3 scoops (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-creatine-monohydrate',
   'Creatine Monohydrate (Generic)', NULL,
   5, '1 teaspoon (5g)',
   0, 0.0, 0.0, 0.0, 0.0,
   '[{"unit":"teaspoon","grams":5,"label":"1 tsp / 1 serving (5g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-bcaa-powder',
   'BCAA 2:1:1 Powder (Generic)', NULL,
   7, '1 scoop (7g)',
   400, 80.0, 0.0, 0.0, 0.0,
   '[{"unit":"scoop","grams":7,"label":"1 scoop (7g)"},{"unit":"scoop","grams":14,"label":"2 scoops (14g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── PROTEIN BARS ──────────────────────────────────────────────────────────────
  ('branded','branded-ritebite-max-protein',
   'RiteBite Max Protein Bar (Choco Berry)', 'RiteBite',
   75, '1 bar (75g)',
   267, 27.0, 27.0, 6.7, 4.0,
   '[{"unit":"bar","grams":75,"label":"1 bar (75g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-yogabar-protein-bar',
   'Yoga Bar Protein Bar (Choco Fudge)', 'Yoga Bar',
   60, '1 bar (60g)',
   413, 28.0, 43.0, 13.0, 3.5,
   '[{"unit":"bar","grams":60,"label":"1 bar (60g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-mb-protein-bar',
   'MuscleBlaze High Protein Bar (Choco Almond)', 'MuscleBlaze',
   70, '1 bar (70g)',
   343, 31.0, 42.0, 8.0, 2.5,
   '[{"unit":"bar","grams":70,"label":"1 bar (70g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-beyond-snack-bar',
   'Beyond Snack Kerala Banana Chips (Salted)', 'Beyond Snack',
   50, '1 serving (50g)',
   530, 2.0, 64.0, 28.0, 3.0,
   '[{"unit":"serving","grams":30,"label":"Small serving (30g)"},{"unit":"serving","grams":50,"label":"Serving (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── OATS ──────────────────────────────────────────────────────────────────────
  ('branded','branded-pintola-high-protein-oats',
   'Pintola High Protein Oats', 'Pintola',
   40, '1 serving / 1 cup dry (40g)',
   380, 17.0, 58.0, 8.0, 9.0,
   '[{"unit":"cup","grams":40,"label":"1 cup dry (40g)"},{"unit":"cup","grams":80,"label":"2 cups dry (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-saffola-oats',
   'Saffola Classic Oats', 'Saffola',
   40, '1 serving (40g)',
   375, 13.0, 66.0, 7.0, 10.0,
   '[{"unit":"serving","grams":40,"label":"1 serving (40g)"},{"unit":"serving","grams":80,"label":"2 servings (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-quaker-oats',
   'Quaker Oats (Rolled)', 'Quaker',
   40, '1 serving (40g)',
   368, 12.5, 62.0, 7.5, 10.0,
   '[{"unit":"serving","grams":40,"label":"1 serving (40g)"},{"unit":"serving","grams":80,"label":"2 servings (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-soulfull-ragi-oats',
   'Soulfull Ragi Oats', 'Soulfull',
   40, '1 serving (40g)',
   358, 9.0, 69.0, 5.0, 8.0,
   '[{"unit":"serving","grams":40,"label":"1 serving (40g)"},{"unit":"serving","grams":80,"label":"2 servings (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-saffola-masala-oats',
   'Saffola Masala Oats (Classic Masala)', 'Saffola',
   40, '1 packet (40g)',
   382, 11.0, 67.0, 7.0, 6.0,
   '[{"unit":"packet","grams":40,"label":"1 packet (40g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── PEANUT BUTTER ─────────────────────────────────────────────────────────────
  ('branded','branded-pintola-pb-creamy',
   'Pintola Classic Creamy Peanut Butter', 'Pintola',
   32, '2 tbsp (32g)',
   588, 27.0, 22.0, 50.0, 6.0,
   '[{"unit":"tablespoon","grams":16,"label":"1 tbsp (16g)"},{"unit":"tablespoon","grams":32,"label":"2 tbsp (32g)"},{"unit":"tablespoon","grams":48,"label":"3 tbsp (48g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-myfitness-pb',
   'MyFitness Natural Peanut Butter (Crunchy)', 'MyFitness',
   32, '2 tbsp (32g)',
   592, 25.0, 20.0, 51.0, 6.0,
   '[{"unit":"tablespoon","grams":16,"label":"1 tbsp (16g)"},{"unit":"tablespoon","grams":32,"label":"2 tbsp (32g)"},{"unit":"tablespoon","grams":48,"label":"3 tbsp (48g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-sundrop-pb',
   'Sundrop Peanut Butter (Creamy)', 'Sundrop',
   32, '2 tbsp (32g)',
   590, 26.0, 20.0, 50.0, 5.0,
   '[{"unit":"tablespoon","grams":16,"label":"1 tbsp (16g)"},{"unit":"tablespoon","grams":32,"label":"2 tbsp (32g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-alpino-pb-natural',
   'Alpino Natural Peanut Butter (Unsweetened)', 'Alpino',
   32, '2 tbsp (32g)',
   585, 26.0, 21.0, 49.0, 6.0,
   '[{"unit":"tablespoon","grams":16,"label":"1 tbsp (16g)"},{"unit":"tablespoon","grams":32,"label":"2 tbsp (32g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── MUESLI & GRANOLA ──────────────────────────────────────────────────────────
  ('branded','branded-yogabar-muesli',
   'Yoga Bar Muesli (Fruits, Nuts & Seeds)', 'Yoga Bar',
   60, '1 bowl (60g)',
   380, 9.0, 65.0, 9.0, 8.0,
   '[{"unit":"bowl","grams":50,"label":"Small bowl (50g)"},{"unit":"bowl","grams":60,"label":"Bowl (60g)"},{"unit":"bowl","grams":80,"label":"Large bowl (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-true-elements-muesli',
   'True Elements Muesli (5 Super Seeds)', 'True Elements',
   60, '1 bowl (60g)',
   375, 10.0, 62.0, 10.0, 9.0,
   '[{"unit":"bowl","grams":50,"label":"Small bowl (50g)"},{"unit":"bowl","grams":60,"label":"Bowl (60g)"},{"unit":"bowl","grams":80,"label":"Large bowl (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-kelloggs-chocos',
   'Kellogg''s Chocos', 'Kellogg''s',
   30, '1 bowl (30g)',
   388, 8.0, 83.0, 2.5, 2.0,
   '[{"unit":"bowl","grams":30,"label":"1 bowl (30g)"},{"unit":"bowl","grams":50,"label":"Large bowl (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-kelloggs-corn-flakes',
   'Kellogg''s Corn Flakes (Original)', 'Kellogg''s',
   30, '1 bowl (30g)',
   377, 7.0, 84.0, 1.0, 1.0,
   '[{"unit":"bowl","grams":30,"label":"1 bowl (30g)"},{"unit":"bowl","grams":50,"label":"Large bowl (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-kelloggs-special-k',
   'Kellogg''s Special K (Original)', 'Kellogg''s',
   30, '1 bowl (30g)',
   378, 15.0, 78.0, 1.0, 2.0,
   '[{"unit":"bowl","grams":30,"label":"1 bowl (30g)"},{"unit":"bowl","grams":50,"label":"Large bowl (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── BISCUITS & SNACKS ─────────────────────────────────────────────────────────
  ('branded','branded-britannia-nutrichoice-digestive',
   'Britannia NutriChoice Digestive (High Fibre)', 'Britannia',
   25, '3 biscuits (25g)',
   475, 8.0, 62.0, 22.0, 5.0,
   '[{"unit":"biscuit","grams":8,"label":"1 biscuit (8g)"},{"unit":"biscuit","grams":25,"label":"3 biscuits (25g)"},{"unit":"biscuit","grams":50,"label":"6 biscuits (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-mcvities-digestive',
   'McVitie''s Digestive Original', 'McVitie''s',
   28, '2 biscuits (28g)',
   471, 7.5, 62.0, 20.0, 4.0,
   '[{"unit":"biscuit","grams":14,"label":"1 biscuit (14g)"},{"unit":"biscuit","grams":28,"label":"2 biscuits (28g)"},{"unit":"biscuit","grams":56,"label":"4 biscuits (56g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-parle-monaco',
   'Parle Monaco Salted Biscuits', 'Parle',
   20, '3 biscuits (20g)',
   471, 8.0, 67.0, 20.0, 1.0,
   '[{"unit":"biscuit","grams":7,"label":"1 biscuit (7g)"},{"unit":"biscuit","grams":20,"label":"3 biscuits (20g)"},{"unit":"biscuit","grams":40,"label":"6 biscuits (40g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-sunfeast-dark-fantasy',
   'Sunfeast Dark Fantasy Choco Fills', 'Sunfeast',
   28, '2 pieces (28g)',
   528, 5.5, 68.0, 26.0, 1.0,
   '[{"unit":"piece","grams":14,"label":"1 piece (14g)"},{"unit":"piece","grams":28,"label":"2 pieces (28g)"},{"unit":"piece","grams":56,"label":"4 pieces (56g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-britannia-good-day',
   'Britannia Good Day Cashew Biscuits', 'Britannia',
   32, '2 biscuits (32g)',
   505, 7.0, 66.0, 24.0, 1.0,
   '[{"unit":"biscuit","grams":16,"label":"1 biscuit (16g)"},{"unit":"biscuit","grams":32,"label":"2 biscuits (32g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-lays-classic',
   'Lay''s Classic Salted Chips', 'Lay''s',
   26, '1 small pack (26g)',
   536, 7.0, 52.0, 35.0, 1.5,
   '[{"unit":"pack","grams":26,"label":"Small pack (26g)"},{"unit":"pack","grams":52,"label":"Large pack (52g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-bikaji-bhujia',
   'Bikaji Bikaneri Bhujia', 'Bikaji',
   40, '1 serving (40g)',
   483, 13.0, 55.0, 24.0, 5.0,
   '[{"unit":"serving","grams":30,"label":"Small serving (30g)"},{"unit":"serving","grams":40,"label":"Serving (40g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── CHOCOLATE ─────────────────────────────────────────────────────────────────
  ('branded','branded-cadbury-dairy-milk',
   'Cadbury Dairy Milk (Milk Chocolate)', 'Cadbury',
   40, '1 bar (40g)',
   524, 7.0, 57.0, 30.0, 0.5,
   '[{"unit":"bar","grams":40,"label":"1 bar (40g)"},{"unit":"bar","grams":80,"label":"2 bars (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-amul-dark-chocolate',
   'Amul Dark Chocolate (55% Cocoa)', 'Amul',
   40, '1 bar (40g)',
   526, 7.0, 58.0, 30.0, 3.0,
   '[{"unit":"square","grams":10,"label":"2 squares (10g)"},{"unit":"bar","grams":40,"label":"1 bar (40g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-kitkat',
   'KitKat Chocolate Bar', 'Nestlé',
   35, '1 bar (35g)',
   520, 6.0, 60.0, 29.0, 1.0,
   '[{"unit":"finger","grams":9,"label":"1 finger (9g)"},{"unit":"bar","grams":35,"label":"1 bar (35g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── DAIRY ─────────────────────────────────────────────────────────────────────
  ('branded','branded-amul-cheese-slice',
   'Amul Cheese Slices (Processed)', 'Amul',
   20, '1 slice (20g)',
   312, 20.0, 3.0, 25.0, 0.0,
   '[{"unit":"slice","grams":20,"label":"1 slice (20g)"},{"unit":"slice","grams":40,"label":"2 slices (40g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-amul-cheese-block',
   'Amul Processed Cheese Block', 'Amul',
   40, '2 cubes (40g)',
   313, 21.0, 2.5, 25.0, 0.0,
   '[{"unit":"cube","grams":20,"label":"1 cube (20g)"},{"unit":"cube","grams":40,"label":"2 cubes (40g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-amul-kool',
   'Amul Kool Flavoured Milk (200ml)', 'Amul',
   200, '1 pack (200ml)',
   68, 3.3, 10.5, 1.5, 0.0,
   '[{"unit":"pack","grams":200,"label":"1 pack (200ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('branded','branded-amul-lassi-pouch',
   'Amul Masti Lassi (200ml pouch)', 'Amul',
   200, '1 pouch (200ml)',
   75, 3.0, 12.0, 1.8, 0.0,
   '[{"unit":"pouch","grams":200,"label":"1 pouch (200ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  -- ── HEALTH DRINKS (POWDER) ────────────────────────────────────────────────────
  ('branded','branded-complan-original',
   'Complan Original Nutrition Drink (Powder)', 'Complan',
   35, '4 heaped tbsp / 1 serving (35g)',
   390, 17.0, 57.0, 11.0, 0.0,
   '[{"unit":"serving","grams":35,"label":"1 serving / 4 tbsp (35g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-horlicks-protein-plus',
   'Horlicks Protein+ (Powder)', 'Horlicks',
   27, '3 tbsp (27g)',
   374, 30.0, 44.0, 9.0, 0.0,
   '[{"unit":"serving","grams":27,"label":"1 serving / 3 tbsp (27g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-boost-powder',
   'Boost (Malt Drink Powder)', 'Boost',
   18, '3 tsp (18g)',
   387, 7.0, 80.0, 4.0, 0.0,
   '[{"unit":"teaspoon","grams":6,"label":"1 tsp (6g)"},{"unit":"serving","grams":18,"label":"3 tsp / 1 serving (18g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-ensure-original',
   'Ensure Original Nutrition Powder (Vanilla)', 'Ensure',
   55, '1 serving (55g) in 200ml water',
   380, 16.0, 57.0, 9.0, 0.0,
   '[{"unit":"serving","grams":55,"label":"1 serving (55g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── PACKAGED DAL & GRAINS ─────────────────────────────────────────────────────
  ('branded','branded-tata-sampann-chana-dal',
   'Tata Sampann Chana Dal (Raw)', 'Tata Sampann',
   50, '½ cup dry (50g)',
   364, 19.0, 61.0, 5.0, 8.0,
   '[{"unit":"cup","grams":50,"label":"½ cup dry (50g)"},{"unit":"cup","grams":100,"label":"1 cup dry (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-tata-sampann-moong-dal',
   'Tata Sampann Moong Dal (Washed, Raw)', 'Tata Sampann',
   50, '½ cup dry (50g)',
   340, 24.0, 56.0, 1.0, 6.0,
   '[{"unit":"cup","grams":50,"label":"½ cup dry (50g)"},{"unit":"cup","grams":100,"label":"1 cup dry (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-india-gate-basmati',
   'India Gate Classic Basmati Rice (Raw)', 'India Gate',
   60, '½ cup dry (60g)',
   348, 7.5, 78.0, 0.5, 0.5,
   '[{"unit":"cup","grams":60,"label":"½ cup dry (60g)"},{"unit":"cup","grams":120,"label":"1 cup dry (120g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-daawat-basmati',
   'Daawat Rozana Basmati Rice (Raw)', 'Daawat',
   60, '½ cup dry (60g)',
   346, 7.0, 78.0, 0.5, 0.5,
   '[{"unit":"cup","grams":60,"label":"½ cup dry (60g)"},{"unit":"cup","grams":120,"label":"1 cup dry (120g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── READY TO EAT ──────────────────────────────────────────────────────────────
  ('branded','branded-mtr-dal-makhani',
   'MTR Dal Makhani (Ready to Eat)', 'MTR',
   300, '1 pack (300g)',
   87, 4.2, 9.8, 3.2, 2.0,
   '[{"unit":"pack","grams":300,"label":"1 pack (300g)"},{"unit":"katori","grams":150,"label":"½ pack / katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-mtr-chana-masala',
   'MTR Chana Masala (Ready to Eat)', 'MTR',
   300, '1 pack (300g)',
   95, 5.0, 12.0, 3.0, 3.0,
   '[{"unit":"pack","grams":300,"label":"1 pack (300g)"},{"unit":"katori","grams":150,"label":"½ pack / katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-gits-dal-tadka',
   'Gits Dal Tadka (Ready to Eat)', 'Gits',
   285, '1 pack (285g)',
   82, 4.0, 10.5, 2.5, 2.0,
   '[{"unit":"pack","grams":285,"label":"1 pack (285g)"},{"unit":"katori","grams":143,"label":"½ pack / katori (143g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-mtr-palak-paneer-rte',
   'MTR Palak Paneer (Ready to Eat)', 'MTR',
   300, '1 pack (300g)',
   112, 6.5, 7.5, 6.5, 1.5,
   '[{"unit":"pack","grams":300,"label":"1 pack (300g)"},{"unit":"katori","grams":150,"label":"½ pack / katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-mtr-mixed-veg-rte',
   'MTR Mixed Vegetable Curry (Ready to Eat)', 'MTR',
   300, '1 pack (300g)',
   78, 2.5, 9.5, 3.5, 2.5,
   '[{"unit":"pack","grams":300,"label":"1 pack (300g)"},{"unit":"katori","grams":150,"label":"½ pack / katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── BREAD ─────────────────────────────────────────────────────────────────────
  ('branded','branded-britannia-whole-wheat-bread',
   'Britannia 100% Whole Wheat Bread', 'Britannia',
   44, '2 slices (44g)',
   245, 9.0, 44.0, 4.0, 5.0,
   '[{"unit":"slice","grams":22,"label":"1 slice (22g)"},{"unit":"slice","grams":44,"label":"2 slices (44g)"},{"unit":"slice","grams":66,"label":"3 slices (66g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-modern-multigrain-bread',
   'Modern Multigrain Bread', 'Modern',
   44, '2 slices (44g)',
   250, 9.0, 48.0, 3.5, 4.0,
   '[{"unit":"slice","grams":22,"label":"1 slice (22g)"},{"unit":"slice","grams":44,"label":"2 slices (44g)"},{"unit":"slice","grams":66,"label":"3 slices (66g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('branded','branded-harvest-gold-bread',
   'Harvest Gold White Sandwich Bread', 'Harvest Gold',
   50, '2 slices (50g)',
   255, 8.0, 50.0, 3.0, 2.0,
   '[{"unit":"slice","grams":25,"label":"1 slice (25g)"},{"unit":"slice","grams":50,"label":"2 slices (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── OILS & COOKING FATS ───────────────────────────────────────────────────────
  ('branded','branded-fortune-refined-sunflower',
   'Fortune Refined Sunflower Oil', 'Fortune',
   10, '1 tbsp (10ml)',
   900, 0.0, 0.0, 100.0, 0.0,
   '[{"unit":"teaspoon","grams":5,"label":"1 tsp (5ml)"},{"unit":"tablespoon","grams":10,"label":"1 tbsp (10ml)"},{"unit":"tablespoon","grams":14,"label":"1 tbsp US (14ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('branded','branded-saffola-gold-oil',
   'Saffola Gold Oil (Rice Bran + Sunflower)', 'Saffola',
   10, '1 tbsp (10ml)',
   900, 0.0, 0.0, 100.0, 0.0,
   '[{"unit":"teaspoon","grams":5,"label":"1 tsp (5ml)"},{"unit":"tablespoon","grams":10,"label":"1 tbsp (10ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('branded','branded-patanjali-ghee',
   'Patanjali Pure Cow Ghee', 'Patanjali',
   10, '1 tsp (10g)',
   900, 0.2, 0.0, 99.5, 0.0,
   '[{"unit":"teaspoon","grams":5,"label":"1 tsp (5g)"},{"unit":"tablespoon","grams":14,"label":"1 tbsp (14g)"},{"unit":"gram","grams":100,"label":"100g"}]')

ON CONFLICT (source, source_id) DO NOTHING;

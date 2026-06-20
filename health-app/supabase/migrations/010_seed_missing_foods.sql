-- 010_seed_missing_foods.sql
-- High-priority missing foods frequently searched by Indian users.
-- Idempotent: ON CONFLICT (source, source_id) DO NOTHING.

INSERT INTO foods (
  source, source_id, name, brand, serving_size_g, serving_description,
  kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g,
  fiber_g_per_100g, common_portions
)
VALUES
  -- Soya chunks (dry/raw) — very popular protein source in Indian gyms
  (
    'ifct', 'ifct_soya_chunks_dry',
    'Soya chunks (raw)', NULL,
    30, '1 small handful (30g)',
    336, 52.4, 33.0, 0.5, 13.0,
    '[
      {"unit":"handful","grams":30,"label":"Small handful (30g) — ~100 kcal"},
      {"unit":"handful","grams":50,"label":"Large handful (50g) — ~168 kcal"},
      {"unit":"katori","grams":100,"label":"1 katori dry (100g) — ~336 kcal"},
      {"unit":"gram","grams":100,"label":"100g"}
    ]'::jsonb
  ),
  -- Soya chunks (cooked/soaked) — absorb water and expand ~3x
  (
    'ifct', 'ifct_soya_chunks_cooked',
    'Soya chunks (cooked)', NULL,
    150, '1 katori (150g)',
    112, 10.8, 6.3, 0.5, 2.5,
    '[
      {"unit":"katori","grams":100,"label":"Small katori (100g)"},
      {"unit":"katori","grams":150,"label":"Katori (150g)"},
      {"unit":"katori","grams":200,"label":"Large katori (200g)"},
      {"unit":"gram","grams":100,"label":"100g"}
    ]'::jsonb
  ),
  -- Amul Chaas (Buttermilk) — one of the most searched Indian dairy drinks
  (
    'ifct', 'ifct_amul_chaas',
    'Chaas (Buttermilk)', 'Amul',
    200, '1 glass (200ml)',
    15, 0.8, 2.0, 0.3, 0.0,
    '[
      {"unit":"glass","grams":200,"label":"1 glass (200ml)"},
      {"unit":"glass","grams":400,"label":"2 glasses (400ml)"},
      {"unit":"glass","grams":100,"label":"Half glass (100ml)"},
      {"unit":"gram","grams":100,"label":"100ml"}
    ]'::jsonb
  ),
  -- Amul Dahi (Full Fat) — most common curd brand in India
  (
    'ifct', 'ifct_amul_dahi_fullfat',
    'Dahi / Curd (full fat)', 'Amul',
    150, '1 katori (150g)',
    98, 3.1, 4.7, 7.5, 0.0,
    '[
      {"unit":"katori","grams":100,"label":"Small katori (100g)"},
      {"unit":"katori","grams":150,"label":"Katori (150g)"},
      {"unit":"katori","grams":200,"label":"Large katori (200g)"},
      {"unit":"gram","grams":100,"label":"100g"}
    ]'::jsonb
  ),
  -- Amul Butter (salted) — used daily in Indian cooking and on roti
  (
    'ifct', 'ifct_amul_butter_salted',
    'Butter (salted)', 'Amul',
    5, '1 tsp (5g)',
    720, 0.6, 0.6, 80.0, 0.0,
    '[
      {"unit":"tsp","grams":5,"label":"1 tsp (5g) — ~36 kcal"},
      {"unit":"tbsp","grams":14,"label":"1 tbsp (14g) — ~100 kcal"},
      {"unit":"slice","grams":10,"label":"1 thin spread (10g) — ~72 kcal"},
      {"unit":"gram","grams":100,"label":"100g"}
    ]'::jsonb
  )
ON CONFLICT (source, source_id) DO NOTHING;

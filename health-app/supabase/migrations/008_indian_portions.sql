-- 008_indian_portions.sql
-- Adds common_portions (jsonb) to foods, fixes Indian serving sizes,
-- and inserts tadka/tempering companion entries.
-- Safe to re-run (idempotent via IF NOT EXISTS + ON CONFLICT).

-- ── 1. ADD COLUMN ─────────────────────────────────────────────────────────────
ALTER TABLE foods ADD COLUMN IF NOT EXISTS common_portions jsonb DEFAULT '[]'::jsonb;

-- ── 2. ROTI / CHAPATI ─────────────────────────────────────────────────────────
UPDATE foods SET
  serving_size_g      = 35,
  serving_description = '1 piece (35g)',
  common_portions     = '[
    {"unit":"piece","grams":35,"label":"1 roti"},
    {"unit":"piece","grams":70,"label":"2 rotis"},
    {"unit":"piece","grams":105,"label":"3 rotis"},
    {"unit":"gram","grams":100,"label":"100g"}
  ]'::jsonb
WHERE source = 'ifct'
  AND (name ILIKE '%roti%' OR name ILIKE '%chapati%' OR name ILIKE '%chapathi%');

-- ── 3. PARATHA ────────────────────────────────────────────────────────────────
UPDATE foods SET
  serving_size_g      = 70,
  serving_description = '1 piece (70g)',
  common_portions     = '[
    {"unit":"piece","grams":70,"label":"1 paratha"},
    {"unit":"piece","grams":140,"label":"2 parathas"},
    {"unit":"gram","grams":100,"label":"100g"}
  ]'::jsonb
WHERE source = 'ifct' AND name ILIKE '%paratha%';

-- ── 4. PURI / BHATURA ─────────────────────────────────────────────────────────
UPDATE foods SET
  serving_size_g      = 25,
  serving_description = '1 piece (25g)',
  common_portions     = '[
    {"unit":"piece","grams":25,"label":"1 puri"},
    {"unit":"piece","grams":75,"label":"3 puris"},
    {"unit":"piece","grams":125,"label":"5 puris"},
    {"unit":"gram","grams":100,"label":"100g"}
  ]'::jsonb
WHERE source = 'ifct' AND (name ILIKE '%puri%' OR name ILIKE '%bhatura%' OR name ILIKE '%bhature%');

-- ── 5. NAAN ───────────────────────────────────────────────────────────────────
UPDATE foods SET
  serving_size_g      = 90,
  serving_description = '1 piece (90g)',
  common_portions     = '[
    {"unit":"piece","grams":90,"label":"1 naan"},
    {"unit":"piece","grams":180,"label":"2 naans"},
    {"unit":"gram","grams":100,"label":"100g"}
  ]'::jsonb
WHERE source = 'ifct' AND name ILIKE '%naan%';

-- ── 6. RICE (cooked) ──────────────────────────────────────────────────────────
UPDATE foods SET
  serving_size_g      = 150,
  serving_description = '1 katori cooked (150g)',
  common_portions     = '[
    {"unit":"katori","grams":150,"label":"1 katori (medium bowl)"},
    {"unit":"katori","grams":300,"label":"2 katori"},
    {"unit":"plate","grams":250,"label":"1 plate"},
    {"unit":"gram","grams":100,"label":"100g"}
  ]'::jsonb
WHERE source = 'ifct'
  AND (name ILIKE '%rice%' OR name ILIKE '%chawal%')
  AND name NOT ILIKE '%flour%'
  AND name NOT ILIKE '%puffed%'
  AND name NOT ILIKE '%flaked%'
  AND name NOT ILIKE '%raw%';

-- ── 7. IDLI ───────────────────────────────────────────────────────────────────
UPDATE foods SET
  serving_size_g      = 40,
  serving_description = '1 piece (40g)',
  common_portions     = '[
    {"unit":"piece","grams":40,"label":"1 idli"},
    {"unit":"piece","grams":80,"label":"2 idlis"},
    {"unit":"piece","grams":120,"label":"3 idlis"},
    {"unit":"piece","grams":160,"label":"4 idlis"},
    {"unit":"gram","grams":100,"label":"100g"}
  ]'::jsonb
WHERE source = 'ifct' AND name ILIKE '%idli%';

-- ── 8. DOSA ───────────────────────────────────────────────────────────────────
UPDATE foods SET
  serving_size_g      = 80,
  serving_description = '1 piece (80g)',
  common_portions     = '[
    {"unit":"piece","grams":80,"label":"1 dosa"},
    {"unit":"piece","grams":160,"label":"2 dosas"},
    {"unit":"gram","grams":100,"label":"100g"}
  ]'::jsonb
WHERE source = 'ifct' AND name ILIKE '%dosa%';

-- ── 9. VADA / WADA ───────────────────────────────────────────────────────────
UPDATE foods SET
  serving_size_g      = 30,
  serving_description = '1 piece (30g)',
  common_portions     = '[
    {"unit":"piece","grams":30,"label":"1 vada"},
    {"unit":"piece","grams":60,"label":"2 vadas"},
    {"unit":"gram","grams":100,"label":"100g"}
  ]'::jsonb
WHERE source = 'ifct' AND (name ILIKE '%vada%' OR name ILIKE '%wada%');

-- ── 10. UTTAPAM ───────────────────────────────────────────────────────────────
UPDATE foods SET
  serving_size_g      = 80,
  serving_description = '1 piece (80g)',
  common_portions     = '[
    {"unit":"piece","grams":80,"label":"1 uttapam"},
    {"unit":"piece","grams":160,"label":"2 uttapam"},
    {"unit":"gram","grams":100,"label":"100g"}
  ]'::jsonb
WHERE source = 'ifct' AND name ILIKE '%uttapam%';

-- ── 11. SAMOSA / KACHORI ─────────────────────────────────────────────────────
UPDATE foods SET
  serving_size_g      = 60,
  serving_description = '1 piece (60g)',
  common_portions     = '[
    {"unit":"piece","grams":60,"label":"1 samosa"},
    {"unit":"piece","grams":120,"label":"2 samosas"},
    {"unit":"gram","grams":100,"label":"100g"}
  ]'::jsonb
WHERE source = 'ifct' AND (name ILIKE '%samosa%' OR name ILIKE '%kachori%');

-- ── 12. EGG ───────────────────────────────────────────────────────────────────
UPDATE foods SET
  serving_size_g      = 50,
  serving_description = '1 egg (50g)',
  common_portions     = '[
    {"unit":"piece","grams":50,"label":"1 egg"},
    {"unit":"piece","grams":100,"label":"2 eggs"},
    {"unit":"piece","grams":150,"label":"3 eggs"},
    {"unit":"gram","grams":100,"label":"100g"}
  ]'::jsonb
WHERE source = 'ifct' AND name ILIKE '%egg%';

-- ── 13. DAL / LENTIL ─────────────────────────────────────────────────────────
UPDATE foods SET
  serving_size_g      = 200,
  serving_description = '1 katori (200ml)',
  common_portions     = '[
    {"unit":"katori","grams":150,"label":"1 small katori (150ml)"},
    {"unit":"katori","grams":200,"label":"1 katori (200ml)"},
    {"unit":"katori","grams":300,"label":"1 large katori (300ml)"},
    {"unit":"gram","grams":100,"label":"100g"}
  ]'::jsonb
WHERE source = 'ifct'
  AND (name ILIKE '%dal%' OR name ILIKE '%daal%' OR name ILIKE '%lentil%');

-- ── 14. SABZI / CURRY / PANEER ───────────────────────────────────────────────
UPDATE foods SET
  serving_size_g      = 150,
  serving_description = '1 katori (150g)',
  common_portions     = '[
    {"unit":"katori","grams":100,"label":"1 small katori (100g)"},
    {"unit":"katori","grams":150,"label":"1 katori (150g)"},
    {"unit":"katori","grams":200,"label":"1 large katori (200g)"},
    {"unit":"gram","grams":100,"label":"100g"}
  ]'::jsonb
WHERE source = 'ifct'
  AND (
    name ILIKE '%sabzi%' OR name ILIKE '%subzi%'
    OR name ILIKE '%curry%' OR name ILIKE '%masala%'
    OR name ILIKE '%bhaji%' OR name ILIKE '%bhurji%'
    OR name ILIKE '%paneer%'
  )
  AND name NOT ILIKE '%puri%';

-- ── 15. POHA / UPMA / KHICHDI ────────────────────────────────────────────────
UPDATE foods SET
  serving_size_g      = 200,
  serving_description = '1 plate (200g)',
  common_portions     = '[
    {"unit":"plate","grams":150,"label":"1 small plate (150g)"},
    {"unit":"plate","grams":200,"label":"1 medium plate (200g)"},
    {"unit":"plate","grams":300,"label":"1 large plate (300g)"},
    {"unit":"gram","grams":100,"label":"100g"}
  ]'::jsonb
WHERE source = 'ifct'
  AND (name ILIKE '%poha%' OR name ILIKE '%upma%'
    OR name ILIKE '%khichdi%' OR name ILIKE '%khichri%');

-- ── 16. BIRYANI / PULAO ──────────────────────────────────────────────────────
UPDATE foods SET
  serving_size_g      = 250,
  serving_description = '1 plate (250g)',
  common_portions     = '[
    {"unit":"plate","grams":200,"label":"1 small plate (200g)"},
    {"unit":"plate","grams":250,"label":"1 medium plate (250g)"},
    {"unit":"plate","grams":350,"label":"1 large plate (350g)"},
    {"unit":"katori","grams":150,"label":"1 katori (150g)"},
    {"unit":"gram","grams":100,"label":"100g"}
  ]'::jsonb
WHERE source = 'ifct'
  AND (name ILIKE '%biryani%' OR name ILIKE '%pulao%');

-- ── 17. TADKA / TEMPERING COMPANION ENTRIES ──────────────────────────────────
INSERT INTO foods (source, source_id, name, brand, serving_size_g, serving_description,
  kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g,
  common_portions)
VALUES
  (
    'ifct', 'ifct_tadka_ghee',
    'Tadka — ghee (tempering)', NULL,
    5, '1 tsp ghee (5g)',
    900, 0.1, 0, 99.5, 0,
    '[{"unit":"tsp","grams":5,"label":"1 tsp — small tadka (~45 kcal)"},{"unit":"tbsp","grams":15,"label":"1 tbsp — full tadka (~135 kcal)"},{"unit":"gram","grams":100,"label":"100g"}]'::jsonb
  ),
  (
    'ifct', 'ifct_tadka_oil',
    'Tadka — oil (tempering)', NULL,
    10, '1 tbsp oil (10g)',
    900, 0, 0, 100, 0,
    '[{"unit":"tsp","grams":5,"label":"1 tsp — small tadka (~45 kcal)"},{"unit":"tbsp","grams":10,"label":"1 tbsp — standard tadka (~90 kcal)"},{"unit":"gram","grams":100,"label":"100g"}]'::jsonb
  ),
  (
    'ifct', 'ifct_cooking_oil',
    'Cooking oil (sabzi / stir-fry)', NULL,
    10, '1 tbsp (10g)',
    900, 0, 0, 100, 0,
    '[{"unit":"tsp","grams":5,"label":"1 tsp (~45 kcal)"},{"unit":"tbsp","grams":10,"label":"1 tbsp (~90 kcal)"},{"unit":"gram","grams":100,"label":"100g"}]'::jsonb
  )
ON CONFLICT (source, source_id) DO NOTHING;

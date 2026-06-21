-- 017_expanded_foods.sql
-- ~145 new foods: South Indian, Gujarati, Bengali, Punjabi, Maharashtrian,
-- Rajasthani, raw spices, health/fitness foods, street food, fish, millets, more.
-- Idempotent: ON CONFLICT (source, source_id) DO NOTHING.

INSERT INTO foods (
  source, source_id, name, brand, serving_size_g, serving_description,
  kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g,
  fiber_g_per_100g, common_portions
)
VALUES

  -- ── SOUTH INDIAN ──────────────────────────────────────────────────────────────
  ('ifct','ifct-rava-dosa',         'Rava Dosa',                          NULL, 100,'1 piece (100g)',          175,  4.5, 28.0,  5.5,  1.0,
   '[{"unit":"piece","grams":100,"label":"1 piece (100g)"},{"unit":"piece","grams":200,"label":"2 pieces (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-set-dosa',          'Set Dosa (3 small)',                  NULL, 120,'3 small dosas (120g)',    145,  3.8, 26.0,  3.0,  0.8,
   '[{"unit":"serving","grams":120,"label":"3 dosas (120g)"},{"unit":"serving","grams":80,"label":"2 dosas (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-pesarattu',         'Pesarattu (Moong Dal Dosa)',          NULL, 100,'1 piece (100g)',          148,  7.2, 22.0,  3.2,  2.5,
   '[{"unit":"piece","grams":100,"label":"1 piece (100g)"},{"unit":"piece","grams":200,"label":"2 pieces (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-idiyappam',         'Idiyappam (Rice String Hoppers)',     NULL, 100,'1 serving (100g)',        120,  2.5, 26.0,  0.4,  0.5,
   '[{"unit":"serving","grams":100,"label":"1 serving (100g)"},{"unit":"serving","grams":150,"label":"1½ servings (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-avial',             'Avial (Kerala Mixed Veg with Coconut)',NULL,150,'1 katori (150g)',           80,  2.0,  8.0,  4.5,  2.5,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"katori","grams":225,"label":"Large katori (225g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-kootu',             'Kootu (Vegetable Dal Coconut Stir Fry)',NULL,150,'1 katori (150g)',          90,  4.0, 10.0,  3.5,  2.8,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"katori","grams":225,"label":"Large katori (225g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-coconut-chutney',   'Coconut Chutney',                    NULL,  40,'2 tbsp (40g)',             185,  2.0,  8.5, 16.0,  3.5,
   '[{"unit":"tablespoon","grams":20,"label":"1 tbsp (20g)"},{"unit":"tablespoon","grams":40,"label":"2 tbsp (40g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-tomato-chutney',    'Tomato Chutney',                     NULL,  40,'2 tbsp (40g)',              65,  1.5,  8.5,  3.0,  1.5,
   '[{"unit":"tablespoon","grams":20,"label":"1 tbsp (20g)"},{"unit":"tablespoon","grams":40,"label":"2 tbsp (40g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-kerala-parotta',    'Kerala Parotta (Malabar)',            NULL, 100,'1 parotta (100g)',         252,  6.5, 40.0,  8.0,  1.2,
   '[{"unit":"piece","grams":100,"label":"1 parotta (100g)"},{"unit":"piece","grams":200,"label":"2 parottas (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-bisi-bele-bath',    'Bisi Bele Bath (Karnataka)',         NULL, 200,'1 katori (200g)',           110,  4.2, 18.0,  2.5,  2.5,
   '[{"unit":"katori","grams":150,"label":"Small katori (150g)"},{"unit":"katori","grams":200,"label":"Katori (200g)"},{"unit":"katori","grams":300,"label":"Large katori (300g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-vangi-bath',        'Vangi Bath (Brinjal Rice)',           NULL, 200,'1 katori (200g)',          162,  3.5, 30.0,  3.8,  2.0,
   '[{"unit":"katori","grams":150,"label":"Small katori (150g)"},{"unit":"katori","grams":200,"label":"Katori (200g)"},{"unit":"katori","grams":300,"label":"Large katori (300g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-kerala-fish-curry', 'Kerala Fish Curry (with Coconut)',   NULL, 200,'1 katori (200g)',           128, 15.0,  4.5,  6.0,  0.8,
   '[{"unit":"katori","grams":150,"label":"Small katori (150g)"},{"unit":"katori","grams":200,"label":"Katori (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-meen-kulambu',      'Meen Kulambu (Tamil Fish Curry)',    NULL, 200,'1 katori (200g)',           112, 13.0,  5.5,  5.0,  0.5,
   '[{"unit":"katori","grams":150,"label":"Small katori (150g)"},{"unit":"katori","grams":200,"label":"Katori (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-mor-kuzhambu',      'Mor Kuzhambu (Buttermilk Curry)',    NULL, 150,'1 katori (150g)',            42,  2.0,  5.0,  1.8,  0.5,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-poriyal',           'Poriyal (Stir Fried Vegetable)',     NULL, 150,'1 katori (150g)',            68,  2.0,  7.5,  3.2,  2.5,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"katori","grams":225,"label":"Large katori (225g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-thoran',            'Thoran (Kerala Coconut Stir Fry)',   NULL, 150,'1 katori (150g)',            82,  2.5,  8.5,  4.5,  3.0,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-puliyogare',        'Puliyogare / Tamarind Rice',         NULL, 200,'1 katori (200g)',           168,  3.0, 32.0,  3.8,  1.5,
   '[{"unit":"katori","grams":150,"label":"Small katori (150g)"},{"unit":"katori","grams":200,"label":"Katori (200g)"},{"unit":"katori","grams":300,"label":"Large katori (300g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-kerala-chicken-stew','Kerala Chicken Stew',               NULL, 200,'1 katori (200g)',           135, 14.0,  6.0,  6.5,  1.2,
   '[{"unit":"katori","grams":150,"label":"Small katori (150g)"},{"unit":"katori","grams":200,"label":"Katori (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-parippu-curry',     'Parippu Curry (Kerala Dal)',         NULL, 200,'1 katori (200g)',            85,  4.5, 11.0,  2.5,  2.5,
   '[{"unit":"katori","grams":150,"label":"Small katori (150g)"},{"unit":"katori","grams":200,"label":"Katori (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-ada-pradhaman',     'Ada Pradhaman (Kerala Payasam)',     NULL, 150,'1 katori (150g)',           180,  3.5, 32.0,  5.0,  0.8,
   '[{"unit":"katori","grams":100,"label":"Small katori (100g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── GUJARATI ──────────────────────────────────────────────────────────────────
  ('ifct','ifct-fafda',             'Fafda (Besan Snack)',                 NULL,  50,'1 serving (50g)',           395,  9.5, 50.0, 18.0,  3.5,
   '[{"unit":"serving","grams":30,"label":"Small serving (30g)"},{"unit":"serving","grams":50,"label":"Serving (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-undhiyu',           'Undhiyu (Gujarati Mixed Veg)',       NULL, 150,'1 katori (150g)',           138,  4.5, 16.0,  7.0,  3.5,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"katori","grams":225,"label":"Large katori (225g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-muthia',            'Muthia (Steamed Dumplings)',         NULL, 100,'4–5 pieces (100g)',         160,  6.0, 26.0,  3.5,  2.5,
   '[{"unit":"piece","grams":20,"label":"1 piece (20g)"},{"unit":"serving","grams":100,"label":"4-5 pieces (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-sev-tameta',        'Sev Tameta Nu Shaak (Tomato Sev)',   NULL, 150,'1 katori (150g)',            92,  3.0, 12.0,  3.8,  1.8,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-gujarati-dal',      'Gujarati Dal (Sweet Toor Dal)',      NULL, 150,'1 katori (150g)',            95,  5.0, 15.0,  2.0,  2.5,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-basundi',           'Basundi (Thickened Sweetened Milk)', NULL, 100,'1 katori (100g)',           180,  6.0, 22.0,  8.0,  0.2,
   '[{"unit":"katori","grams":100,"label":"Katori (100g)"},{"unit":"katori","grams":150,"label":"Large katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-sukhdi',            'Sukhdi / Gudpapdi (Wheat Sweet)',    NULL,  40,'1 piece (40g)',             478,  8.0, 58.0, 24.0,  1.5,
   '[{"unit":"piece","grams":40,"label":"1 piece (40g)"},{"unit":"piece","grams":80,"label":"2 pieces (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-methi-gota',        'Methi Na Gota (Fenugreek Fritters)', NULL,  80,'4 pieces (80g)',            225,  7.5, 28.0,  9.5,  3.0,
   '[{"unit":"piece","grams":20,"label":"1 piece (20g)"},{"unit":"serving","grams":80,"label":"4 pieces (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-khakra',            'Khakra (Thin Crispy Flatbread)',     NULL,  30,'2 pieces (30g)',            372, 11.0, 65.0,  8.0,  4.5,
   '[{"unit":"piece","grams":15,"label":"1 piece (15g)"},{"unit":"piece","grams":30,"label":"2 pieces (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-adadiya',           'Adadiya Pak (Winter Urad Sweet)',    NULL,  40,'1 piece (40g)',             465, 15.0, 48.0, 25.0,  2.0,
   '[{"unit":"piece","grams":40,"label":"1 piece (40g)"},{"unit":"piece","grams":80,"label":"2 pieces (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── BENGALI ───────────────────────────────────────────────────────────────────
  ('ifct','ifct-hilsa-curry',       'Hilsa Fish (Ilish) Curry',           NULL, 150,'1 piece with gravy (150g)',185, 17.0,  3.0, 12.0,  0.5,
   '[{"unit":"piece","grams":100,"label":"1 piece (100g)"},{"unit":"piece","grams":150,"label":"1 piece + gravy (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-mishti-doi',        'Mishti Doi (Sweetened Curd)',        NULL, 150,'1 earthen pot (150g)',      140,  5.0, 22.0,  4.0,  0.0,
   '[{"unit":"pot","grams":100,"label":"Small pot (100g)"},{"unit":"pot","grams":150,"label":"Pot (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-sandesh',           'Sandesh (Bengali Sweet)',            NULL,  50,'2 pieces (50g)',            285,  9.0, 48.0,  7.0,  0.2,
   '[{"unit":"piece","grams":25,"label":"1 piece (25g)"},{"unit":"piece","grams":50,"label":"2 pieces (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-kosha-mangsho',     'Kosha Mangsho (Bengali Spiced Mutton)',NULL,150,'1 katori (150g)',          218, 19.0,  4.5, 14.0,  0.5,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-luchi',             'Luchi (Bengali Deep-Fried Puri)',    NULL,  60,'2 pieces (60g)',            282,  6.0, 38.0, 12.0,  1.5,
   '[{"unit":"piece","grams":30,"label":"1 luchi (30g)"},{"unit":"piece","grams":60,"label":"2 luchis (60g)"},{"unit":"piece","grams":90,"label":"3 luchis (90g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-aloo-posto',        'Aloo Posto (Potato with Poppy Seeds)',NULL,150,'1 katori (150g)',           148,  2.5, 18.0,  7.5,  2.0,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-shorshe-ilish',     'Shorshe Ilish (Mustard Hilsa)',      NULL, 150,'1 piece with gravy (150g)',202, 18.0,  2.5, 14.0,  0.5,
   '[{"unit":"piece","grams":150,"label":"1 piece + gravy (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-begun-bhaja',       'Begun Bhaja (Fried Brinjal)',        NULL, 100,'2 slices (100g)',           125,  1.5,  8.5,  9.5,  2.0,
   '[{"unit":"slice","grams":50,"label":"1 slice (50g)"},{"unit":"slice","grams":100,"label":"2 slices (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-doi-maach',         'Doi Maach (Fish in Curd Curry)',     NULL, 150,'1 katori (150g)',           148, 16.0,  5.5,  7.0,  0.5,
   '[{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-chingri-malai',     'Chingri Malai Curry (Prawn Coconut)',NULL, 150,'1 katori (150g)',           195, 17.0,  4.0, 12.0,  1.0,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-malpua',            'Malpua (Sweet Pancake)',             NULL,  80,'2 pieces (80g)',            338,  5.0, 52.0, 14.0,  0.5,
   '[{"unit":"piece","grams":40,"label":"1 piece (40g)"},{"unit":"piece","grams":80,"label":"2 pieces (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-patishapta',        'Patishapta (Crepe with Filling)',    NULL, 100,'2 pieces (100g)',           232,  5.5, 36.0,  8.0,  1.5,
   '[{"unit":"piece","grams":50,"label":"1 piece (50g)"},{"unit":"piece","grams":100,"label":"2 pieces (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-mochar-ghonto',     'Mochar Ghonto (Banana Flower)',      NULL, 150,'1 katori (150g)',            88,  3.0, 10.0,  4.0,  3.5,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── PUNJABI (missing items) ───────────────────────────────────────────────────
  ('ifct','ifct-amritsari-fish',    'Amritsari Fish Fry',                 NULL, 100,'4–5 pieces (100g)',         222, 20.0, 12.0, 10.0,  0.8,
   '[{"unit":"serving","grams":100,"label":"4-5 pieces (100g)"},{"unit":"serving","grams":150,"label":"6-7 pieces (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-pindi-chole',       'Pindi Chole (Spiced Chickpeas)',     NULL, 150,'1 katori (150g)',           178,  9.0, 28.0,  3.5,  7.5,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"katori","grams":225,"label":"Large katori (225g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-kulcha-amritsari',  'Kulcha (Amritsari)',                 NULL, 100,'1 kulcha (100g)',           272,  8.5, 50.0,  5.0,  2.0,
   '[{"unit":"piece","grams":100,"label":"1 kulcha (100g)"},{"unit":"piece","grams":200,"label":"2 kulchas (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-tawa-chicken',      'Tawa Chicken (Punjabi)',             NULL, 150,'1 serving (150g)',          188, 22.0,  5.5,  9.0,  0.8,
   '[{"unit":"serving","grams":100,"label":"Small serving (100g)"},{"unit":"serving","grams":150,"label":"Serving (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-mutton-rogan-josh', 'Mutton Rogan Josh (Kashmiri)',       NULL, 150,'1 katori (150g)',           198, 18.0,  5.0, 12.0,  0.8,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-paneer-bhurji',     'Paneer Bhurji (Scrambled Paneer)',   NULL, 150,'1 katori (150g)',           195, 12.0,  5.5, 14.0,  1.0,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-langar-dal',        'Langar Dal (Amritsari Black Dal)',   NULL, 150,'1 katori (150g)',           115,  6.5, 15.0,  3.5,  3.5,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"katori","grams":225,"label":"Large katori (225g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── MAHARASHTRIAN ─────────────────────────────────────────────────────────────
  ('ifct','ifct-puran-poli',        'Puran Poli (Chana Dal Sweet Roti)',  NULL, 100,'1 piece (100g)',            260,  7.0, 48.0,  5.0,  3.5,
   '[{"unit":"piece","grams":100,"label":"1 piece (100g)"},{"unit":"piece","grams":200,"label":"2 pieces (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-batata-vada',       'Batata Vada (Potato Fritter)',       NULL,  80,'2 pieces (80g)',            225,  4.0, 30.0, 10.0,  2.0,
   '[{"unit":"piece","grams":40,"label":"1 vada (40g)"},{"unit":"piece","grams":80,"label":"2 vadas (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-thalipeeth',        'Thalipeeth (Mixed Flour Flatbread)', NULL, 100,'1 piece (100g)',            188,  6.5, 30.0,  4.5,  3.0,
   '[{"unit":"piece","grams":100,"label":"1 piece (100g)"},{"unit":"piece","grams":200,"label":"2 pieces (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-sabudana-khichdi',  'Sabudana Khichdi',                  NULL, 200,'1 katori (200g)',           198,  2.8, 42.0,  3.8,  1.0,
   '[{"unit":"katori","grams":150,"label":"Small katori (150g)"},{"unit":"katori","grams":200,"label":"Katori (200g)"},{"unit":"katori","grams":300,"label":"Large katori (300g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-sabudana-vada',     'Sabudana Vada (Sago Fritter)',       NULL, 100,'2 pieces (100g)',           242,  3.5, 38.0,  8.5,  1.5,
   '[{"unit":"piece","grams":50,"label":"1 vada (50g)"},{"unit":"piece","grams":100,"label":"2 vadas (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-kolhapuri-mutton',  'Kolhapuri Mutton (Spicy)',           NULL, 150,'1 katori (150g)',           218, 19.0,  5.0, 14.0,  1.0,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-shrikhand',         'Shrikhand (Strained Sweetened Curd)',NULL, 100,'1 katori (100g)',           222,  7.0, 38.0,  6.0,  0.0,
   '[{"unit":"katori","grams":75,"label":"Small katori (75g)"},{"unit":"katori","grams":100,"label":"Katori (100g)"},{"unit":"katori","grams":150,"label":"Large katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-aamras',            'Aamras (Mango Pulp)',                NULL, 150,'1 katori (150g)',            75,  0.6, 18.0,  0.3,  1.0,
   '[{"unit":"katori","grams":100,"label":"Katori (100g)"},{"unit":"katori","grams":150,"label":"Large katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-bombil-fry',        'Bombil Fry (Bombay Duck Fish)',      NULL, 100,'2–3 pieces (100g)',         178, 16.0,  8.5,  9.0,  0.5,
   '[{"unit":"piece","grams":50,"label":"1 piece (50g)"},{"unit":"piece","grams":100,"label":"2-3 pieces (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── RAJASTHANI ────────────────────────────────────────────────────────────────
  ('ifct','ifct-dal-baati',         'Dal Baati (Rajasthani)',             NULL, 300,'1 plate (300g)',            380, 12.0, 58.0, 12.0,  4.5,
   '[{"unit":"plate","grams":250,"label":"Small plate (250g)"},{"unit":"plate","grams":300,"label":"Plate (300g)"},{"unit":"plate","grams":400,"label":"Large plate (400g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-gatte-ki-sabzi',    'Gatte Ki Sabzi (Rajasthani)',        NULL, 150,'1 katori (150g)',           165,  7.0, 20.0,  7.0,  2.5,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-ker-sangri',        'Ker Sangri (Rajasthani Desert Beans)',NULL,150,'1 katori (150g)',            95,  4.5, 12.0,  3.5,  5.0,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-churma',            'Churma (Wheat Sweet Crumble)',       NULL,  60,'1 serving (60g)',           440,  8.5, 68.0, 16.0,  3.0,
   '[{"unit":"serving","grams":60,"label":"1 serving (60g)"},{"unit":"serving","grams":100,"label":"Large serving (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-ghevar',            'Ghevar (Rajasthani Lattice Sweet)',  NULL,  80,'1 piece (80g)',             458,  6.0, 65.0, 22.0,  1.0,
   '[{"unit":"piece","grams":80,"label":"1 piece (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-kalakand',          'Kalakand (Milk Sweet)',              NULL,  80,'2 pieces (80g)',            335, 10.0, 52.0, 11.0,  0.2,
   '[{"unit":"piece","grams":40,"label":"1 piece (40g)"},{"unit":"piece","grams":80,"label":"2 pieces (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-daal-churma',       'Dal Churma Combo (Rajasthani Thali)',NULL, 400,'1 thali (400g)',            320, 10.0, 52.0, 10.0,  4.0,
   '[{"unit":"thali","grams":300,"label":"Small thali (300g)"},{"unit":"thali","grams":400,"label":"Thali (400g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── RAW SPICES & MASALAS ──────────────────────────────────────────────────────
  ('ifct','ifct-turmeric-powder',   'Turmeric Powder (Haldi)',            NULL,   5,'1 tsp (5g)',               354,  7.8, 65.0, 10.0, 21.0,
   '[{"unit":"teaspoon","grams":3,"label":"½ tsp (3g)"},{"unit":"teaspoon","grams":5,"label":"1 tsp (5g)"},{"unit":"tablespoon","grams":10,"label":"1 tbsp (10g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-cumin-powder',      'Cumin Powder / Jeera Powder',        NULL,   5,'1 tsp (5g)',               375, 17.8, 44.0, 22.0, 10.5,
   '[{"unit":"teaspoon","grams":3,"label":"½ tsp (3g)"},{"unit":"teaspoon","grams":5,"label":"1 tsp (5g)"},{"unit":"tablespoon","grams":10,"label":"1 tbsp (10g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-coriander-powder',  'Coriander Powder (Dhania Powder)',   NULL,   5,'1 tsp (5g)',               298, 12.4, 49.0, 18.0, 41.0,
   '[{"unit":"teaspoon","grams":3,"label":"½ tsp (3g)"},{"unit":"teaspoon","grams":5,"label":"1 tsp (5g)"},{"unit":"tablespoon","grams":10,"label":"1 tbsp (10g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-chili-powder',      'Red Chili Powder (Lal Mirch)',       NULL,   3,'1 tsp (3g)',               314, 12.0, 56.0, 17.0, 28.0,
   '[{"unit":"teaspoon","grams":2,"label":"½ tsp (2g)"},{"unit":"teaspoon","grams":3,"label":"1 tsp (3g)"},{"unit":"tablespoon","grams":8,"label":"1 tbsp (8g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-garam-masala',      'Garam Masala',                       NULL,   3,'1 tsp (3g)',               379, 13.0, 60.0, 14.0, 12.0,
   '[{"unit":"teaspoon","grams":2,"label":"½ tsp (2g)"},{"unit":"teaspoon","grams":3,"label":"1 tsp (3g)"},{"unit":"tablespoon","grams":8,"label":"1 tbsp (8g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-cumin-seeds',       'Cumin Seeds (Sabut Jeera)',          NULL,   5,'1 tsp (5g)',               375, 17.8, 44.0, 22.0, 10.5,
   '[{"unit":"teaspoon","grams":3,"label":"½ tsp (3g)"},{"unit":"teaspoon","grams":5,"label":"1 tsp (5g)"},{"unit":"tablespoon","grams":10,"label":"1 tbsp (10g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-mustard-seeds',     'Mustard Seeds (Rai / Sarson)',       NULL,   5,'1 tsp (5g)',               508, 26.0, 28.0, 36.0, 12.0,
   '[{"unit":"teaspoon","grams":3,"label":"½ tsp (3g)"},{"unit":"teaspoon","grams":5,"label":"1 tsp (5g)"},{"unit":"tablespoon","grams":10,"label":"1 tbsp (10g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-fenugreek-seeds',   'Fenugreek Seeds (Methi Dana)',       NULL,   5,'1 tsp (5g)',               323, 23.0, 58.0,  6.0, 25.0,
   '[{"unit":"teaspoon","grams":3,"label":"½ tsp (3g)"},{"unit":"teaspoon","grams":5,"label":"1 tsp (5g)"},{"unit":"tablespoon","grams":10,"label":"1 tbsp (10g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-curry-leaves',      'Curry Leaves (Kadi Patta)',          NULL,   5,'1 sprig (5g)',              108,  6.1, 18.0,  1.0,  6.5,
   '[{"unit":"sprig","grams":5,"label":"1 sprig (5g)"},{"unit":"sprig","grams":10,"label":"2 sprigs (10g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-chaat-masala',      'Chaat Masala (Spice Blend)',         NULL,   5,'1 tsp (5g)',               300, 10.0, 48.0, 12.0,  8.0,
   '[{"unit":"teaspoon","grams":3,"label":"½ tsp (3g)"},{"unit":"teaspoon","grams":5,"label":"1 tsp (5g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── STREET FOOD (missing) ─────────────────────────────────────────────────────
  ('ifct','ifct-dabeli',            'Dabeli (Kutchi Street Burger)',       NULL, 130,'1 dabeli (130g)',           225,  6.0, 38.0,  6.5,  2.5,
   '[{"unit":"piece","grams":130,"label":"1 dabeli (130g)"},{"unit":"piece","grams":260,"label":"2 dabelis (260g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-raj-kachori',       'Raj Kachori (Giant Filled Puri)',    NULL, 150,'1 piece (150g)',            278,  8.0, 40.0, 10.0,  3.0,
   '[{"unit":"piece","grams":150,"label":"1 raj kachori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-papri-chaat',       'Papri Chaat',                        NULL, 150,'1 plate (150g)',            188,  4.5, 30.0,  6.0,  2.5,
   '[{"unit":"plate","grams":120,"label":"Small plate (120g)"},{"unit":"plate","grams":150,"label":"Plate (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-aloo-chaat',        'Aloo Chaat',                         NULL, 150,'1 plate (150g)',            152,  3.2, 25.0,  4.5,  2.0,
   '[{"unit":"plate","grams":100,"label":"Small plate (100g)"},{"unit":"plate","grams":150,"label":"Plate (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-fruit-chaat',       'Fruit Chaat',                        NULL, 200,'1 bowl (200g)',              55,  1.0, 13.0,  0.2,  1.5,
   '[{"unit":"bowl","grams":150,"label":"Small bowl (150g)"},{"unit":"bowl","grams":200,"label":"Bowl (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-masala-corn',       'Masala Corn / Corn Chaat',           NULL, 150,'1 cup (150g)',              108,  3.2, 20.0,  2.5,  2.0,
   '[{"unit":"cup","grams":100,"label":"Small cup (100g)"},{"unit":"cup","grams":150,"label":"Cup (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-kathi-roll-veg',    'Veg Kathi Roll / Frankie',           NULL, 180,'1 roll (180g)',             202,  5.5, 32.0,  5.8,  2.0,
   '[{"unit":"roll","grams":180,"label":"1 roll (180g)"},{"unit":"roll","grams":360,"label":"2 rolls (360g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-kathi-roll-egg',    'Egg Kathi Roll',                     NULL, 200,'1 roll (200g)',             218,  8.5, 30.0,  7.5,  1.5,
   '[{"unit":"roll","grams":200,"label":"1 roll (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-kathi-roll-chicken','Chicken Kathi Roll',                  NULL, 220,'1 roll (220g)',             235, 12.0, 30.0,  8.0,  1.5,
   '[{"unit":"roll","grams":220,"label":"1 roll (220g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-masala-papad',      'Masala Papad (Roasted)',             NULL,  25,'1 papad (25g)',              82,  4.0, 12.0,  2.5,  3.0,
   '[{"unit":"piece","grams":12,"label":"1 small papad (12g)"},{"unit":"piece","grams":25,"label":"1 large papad (25g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-chaas',             'Chaas / Buttermilk (Spiced)',        NULL, 250,'1 glass (250ml)',            18,  1.0,  2.0,  0.5,  0.0,
   '[{"unit":"glass","grams":200,"label":"1 glass (200ml)"},{"unit":"glass","grams":250,"label":"Large glass (250ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('ifct','ifct-jal-jeera',         'Jal Jeera (Cumin Water Drink)',      NULL, 250,'1 glass (250ml)',            12,  0.3,  2.5,  0.1,  0.2,
   '[{"unit":"glass","grams":250,"label":"1 glass (250ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  -- ── HEALTH & FITNESS FOODS ────────────────────────────────────────────────────
  ('ifct','ifct-quinoa-cooked',     'Quinoa (Cooked)',                    NULL, 180,'1 katori cooked (180g)',    120,  4.4, 21.0,  1.9,  2.8,
   '[{"unit":"katori","grams":150,"label":"Small katori (150g)"},{"unit":"katori","grams":180,"label":"Katori (180g)"},{"unit":"katori","grams":250,"label":"Large katori (250g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-brown-rice-cooked', 'Brown Rice (Cooked)',                NULL, 180,'1 katori cooked (180g)',    112,  2.6, 23.0,  0.9,  1.8,
   '[{"unit":"katori","grams":150,"label":"Small katori (150g)"},{"unit":"katori","grams":180,"label":"Katori (180g)"},{"unit":"katori","grams":250,"label":"Large katori (250g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-greek-yogurt',      'Greek Yogurt / Hung Curd',           NULL, 150,'1 katori (150g)',            97,  9.0,  3.6,  5.0,  0.0,
   '[{"unit":"katori","grams":100,"label":"Katori (100g)"},{"unit":"katori","grams":150,"label":"Large katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-chia-seeds',        'Chia Seeds',                         NULL,  20,'2 tbsp (20g)',              486, 17.0, 42.0, 31.0, 34.0,
   '[{"unit":"tablespoon","grams":10,"label":"1 tbsp (10g)"},{"unit":"tablespoon","grams":20,"label":"2 tbsp (20g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-sunflower-seeds',   'Sunflower Seeds (Surajmukhi Beej)',  NULL,  30,'2 tbsp (30g)',              584, 20.8, 20.0, 51.5,  9.0,
   '[{"unit":"tablespoon","grams":15,"label":"1 tbsp (15g)"},{"unit":"tablespoon","grams":30,"label":"2 tbsp (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-pumpkin-seeds',     'Pumpkin Seeds (Kaddu Beej)',         NULL,  30,'2 tbsp (30g)',              559, 30.0, 11.0, 49.0,  6.0,
   '[{"unit":"tablespoon","grams":15,"label":"1 tbsp (15g)"},{"unit":"tablespoon","grams":30,"label":"2 tbsp (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-muesli',            'Muesli (Plain, No Added Sugar)',     NULL,  60,'1 bowl (60g)',              338, 10.0, 65.0,  5.0,  8.0,
   '[{"unit":"bowl","grams":50,"label":"Small bowl (50g)"},{"unit":"bowl","grams":60,"label":"Bowl (60g)"},{"unit":"bowl","grams":80,"label":"Large bowl (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-granola',           'Granola (Plain)',                    NULL,  60,'1 bowl (60g)',              402,  8.5, 64.0, 12.0,  5.5,
   '[{"unit":"bowl","grams":50,"label":"Small bowl (50g)"},{"unit":"bowl","grams":60,"label":"Bowl (60g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-tofu',              'Tofu (Firm)',                        NULL, 100,'100g',                       76,  8.0,  1.9,  4.8,  0.3,
   '[{"unit":"slice","grams":50,"label":"1 slice (50g)"},{"unit":"slice","grams":100,"label":"2 slices (100g)"},{"unit":"slice","grams":150,"label":"3 slices (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-soya-chunks-dry',   'Soya Chunks / Nuggets (Dry)',        NULL,  30,'1 handful dry (30g)',       345, 52.0, 33.0,  0.5, 13.0,
   '[{"unit":"handful","grams":30,"label":"1 handful (30g)"},{"unit":"handful","grams":50,"label":"Large handful (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-soya-chunks-cooked','Soya Chunks (Cooked / Rehydrated)',  NULL, 100,'1 katori (100g)',           100, 14.0,  9.0,  0.3,  3.5,
   '[{"unit":"katori","grams":100,"label":"Katori (100g)"},{"unit":"katori","grams":150,"label":"Large katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-paneer-low-fat',    'Paneer Low Fat (Skimmed Milk)',      NULL,  50,'1 piece / 2 cubes (50g)',   180, 18.0,  3.5, 11.0,  0.0,
   '[{"unit":"piece","grams":50,"label":"1 piece (50g)"},{"unit":"piece","grams":100,"label":"2 pieces (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-protein-bar',       'Protein Bar (Generic / MuscleBlaze)',NULL,  60,'1 bar (60g)',              352, 20.0, 45.0, 10.0,  3.0,
   '[{"unit":"bar","grams":60,"label":"1 bar (60g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-sprouts-mixed',     'Mixed Sprouts (Cooked)',             NULL, 100,'1 katori (100g)',            45,  4.0,  6.0,  0.5,  3.0,
   '[{"unit":"katori","grams":100,"label":"Katori (100g)"},{"unit":"katori","grams":150,"label":"Large katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── SWEETS & DESSERTS (missing) ───────────────────────────────────────────────
  ('ifct','ifct-kulfi-plain',       'Kulfi (Plain / Malai)',              NULL,  80,'1 kulfi (80g)',             175,  5.0, 20.0,  9.0,  0.0,
   '[{"unit":"piece","grams":60,"label":"Small kulfi (60g)"},{"unit":"piece","grams":80,"label":"Kulfi (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-falooda',           'Falooda (Rose Milk Dessert)',        NULL, 350,'1 glass (350ml)',           148,  4.0, 28.0,  2.5,  1.0,
   '[{"unit":"glass","grams":250,"label":"Small glass (250ml)"},{"unit":"glass","grams":350,"label":"Glass (350ml)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-shahi-tukda',       'Shahi Tukda (Fried Bread in Rabdi)', NULL,150,'1 serving (150g)',          282,  6.0, 40.0, 11.0,  0.5,
   '[{"unit":"serving","grams":100,"label":"Small serving (100g)"},{"unit":"serving","grams":150,"label":"Serving (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-pinni',             'Pinni (Punjabi Whole Wheat Sweet)',  NULL,  50,'1 piece (50g)',             518, 10.0, 60.0, 28.0,  2.0,
   '[{"unit":"piece","grams":50,"label":"1 pinni (50g)"},{"unit":"piece","grams":100,"label":"2 pinnis (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-kokum-sharbat',     'Kokum / Sol Kadhi Sharbat',         NULL, 200,'1 glass (200ml)',            35,  0.5,  8.5,  0.2,  0.5,
   '[{"unit":"glass","grams":200,"label":"1 glass (200ml)"},{"unit":"glass","grams":300,"label":"Large glass (300ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('ifct','ifct-banana-milkshake',  'Banana Milkshake',                  NULL, 300,'1 glass (300ml)',            95,  3.0, 18.0,  1.5,  0.8,
   '[{"unit":"glass","grams":250,"label":"Small glass (250ml)"},{"unit":"glass","grams":300,"label":"Glass (300ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  -- ── FISH VARIETIES ────────────────────────────────────────────────────────────
  ('ifct','ifct-pomfret',           'Pomfret / Paplet Fish (Cooked)',     NULL, 100,'1 piece (100g)',             96, 18.0,  0.0,  2.5,  0.0,
   '[{"unit":"piece","grams":100,"label":"1 medium piece (100g)"},{"unit":"piece","grams":150,"label":"1 large piece (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-surmai-fish',       'Surmai / Kingfish (Cooked)',         NULL, 100,'1 piece (100g)',            102, 20.0,  0.0,  2.8,  0.0,
   '[{"unit":"piece","grams":100,"label":"1 piece (100g)"},{"unit":"piece","grams":150,"label":"1 large piece (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-rawas-fish',        'Rawas / Indian Salmon (Cooked)',     NULL, 100,'1 piece (100g)',            128, 20.0,  0.0,  5.5,  0.0,
   '[{"unit":"piece","grams":100,"label":"1 piece (100g)"},{"unit":"piece","grams":150,"label":"1 large piece (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-catla-fish',        'Catla / Bengal Carp (Cooked)',       NULL, 100,'1 piece (100g)',             98, 17.0,  0.0,  3.2,  0.0,
   '[{"unit":"piece","grams":100,"label":"1 piece (100g)"},{"unit":"piece","grams":150,"label":"1 large piece (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-bangda-fish',       'Bangda / Indian Mackerel (Cooked)', NULL, 100,'1 piece (100g)',            154, 19.0,  0.0,  8.5,  0.0,
   '[{"unit":"piece","grams":80,"label":"1 small piece (80g)"},{"unit":"piece","grams":100,"label":"1 piece (100g)"},{"unit":"piece","grams":150,"label":"1 large piece (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── MILLETS & ALTERNATIVE GRAINS ──────────────────────────────────────────────
  ('ifct','ifct-jowar-roti',        'Jowar Roti (Sorghum Flatbread)',     NULL,  60,'1 roti (60g)',              182,  4.5, 38.0,  1.5,  3.0,
   '[{"unit":"piece","grams":50,"label":"1 small roti (50g)"},{"unit":"piece","grams":60,"label":"1 roti (60g)"},{"unit":"piece","grams":80,"label":"1 large roti (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-bajra-roti',        'Bajra Roti (Pearl Millet Flatbread)',NULL,  60,'1 roti (60g)',              202,  5.5, 42.0,  2.0,  4.0,
   '[{"unit":"piece","grams":50,"label":"1 small roti (50g)"},{"unit":"piece","grams":60,"label":"1 roti (60g)"},{"unit":"piece","grams":80,"label":"1 large roti (80g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-ragi-dosa',         'Ragi / Finger Millet Dosa',         NULL, 100,'1 piece (100g)',            148,  5.0, 30.0,  1.5,  3.5,
   '[{"unit":"piece","grams":100,"label":"1 piece (100g)"},{"unit":"piece","grams":200,"label":"2 pieces (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-ragi-mudde',        'Ragi Mudde / Sangati (Karnataka)',   NULL, 150,'1 mudde (150g)',            125,  3.5, 27.0,  0.5,  2.5,
   '[{"unit":"piece","grams":100,"label":"Small mudde (100g)"},{"unit":"piece","grams":150,"label":"Mudde (150g)"},{"unit":"piece","grams":200,"label":"Large mudde (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-ragi-porridge',     'Ragi Porridge / Ragi Kanji',        NULL, 200,'1 bowl (200g)',              75,  2.5, 16.0,  0.5,  2.0,
   '[{"unit":"bowl","grams":150,"label":"Small bowl (150g)"},{"unit":"bowl","grams":200,"label":"Bowl (200g)"},{"unit":"bowl","grams":300,"label":"Large bowl (300g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-rajgira-ladoo',     'Rajgira (Amaranth) Ladoo',          NULL,  50,'1 piece (50g)',             398, 10.0, 58.0, 15.0,  4.5,
   '[{"unit":"piece","grams":50,"label":"1 ladoo (50g)"},{"unit":"piece","grams":100,"label":"2 ladoos (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-maida',             'Maida / Refined Flour',             NULL,  30,'2 tbsp (30g)',              348, 10.0, 76.0,  0.9,  0.0,
   '[{"unit":"tablespoon","grams":15,"label":"1 tbsp (15g)"},{"unit":"tablespoon","grams":30,"label":"2 tbsp (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-sabudana-dry',      'Sabudana / Sago / Tapioca Pearls (Dry)',NULL,30,'2 tbsp (30g)',            348,  0.2, 88.0,  0.2,  0.0,
   '[{"unit":"tablespoon","grams":15,"label":"1 tbsp (15g)"},{"unit":"tablespoon","grams":30,"label":"2 tbsp (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-vermicelli-raw',    'Vermicelli / Seviyan (Dry)',         NULL,  30,'1 serving dry (30g)',       350,  9.8, 73.0,  0.8,  2.5,
   '[{"unit":"serving","grams":30,"label":"1 serving dry (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-seviyan-kheer',     'Seviyan Kheer (Vermicelli Pudding)', NULL, 200,'1 katori (200g)',           152,  4.0, 25.0,  4.0,  0.3,
   '[{"unit":"katori","grams":150,"label":"Small katori (150g)"},{"unit":"katori","grams":200,"label":"Katori (200g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── MORE MEAT & PROTEIN ────────────────────────────────────────────────────────
  ('ifct','ifct-mutton-keema',      'Mutton Keema (Minced Mutton)',       NULL, 100,'100g',                      245, 20.0,  2.5, 17.0,  0.0,
   '[{"unit":"katori","grams":100,"label":"Katori (100g)"},{"unit":"katori","grams":150,"label":"Large katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-pork-curry',        'Pork Curry',                         NULL, 150,'1 katori (150g)',           235, 18.0,  4.5, 17.0,  0.5,
   '[{"unit":"katori","grams":113,"label":"Small katori (113g)"},{"unit":"katori","grams":150,"label":"Katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-chicken-liver',     'Chicken Liver (Cooked)',             NULL, 100,'100g',                      167, 24.0,  0.9,  7.5,  0.0,
   '[{"unit":"serving","grams":100,"label":"1 serving (100g)"},{"unit":"serving","grams":150,"label":"Large serving (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-nalli-kebab',       'Nalli / Lamb Chop (Cooked)',         NULL, 120,'1 piece (120g)',            248, 20.0,  0.0, 18.0,  0.0,
   '[{"unit":"piece","grams":100,"label":"1 small piece (100g)"},{"unit":"piece","grams":120,"label":"1 piece (120g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-fish-tikka',        'Fish Tikka (Grilled)',               NULL, 100,'4–5 pieces (100g)',         152, 22.0,  4.0,  5.5,  0.5,
   '[{"unit":"piece","grams":25,"label":"1 piece (25g)"},{"unit":"serving","grams":100,"label":"4-5 pieces (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── MORE VEGETABLES & PRODUCE ─────────────────────────────────────────────────
  ('ifct','ifct-capsicum-red',      'Red Capsicum (Lal Shimla Mirch)',    NULL, 100,'1 medium (100g)',            31,  1.0,  6.0,  0.3,  2.1,
   '[{"unit":"small","grams":80,"label":"1 small (80g)"},{"unit":"medium","grams":100,"label":"1 medium (100g)"},{"unit":"large","grams":150,"label":"1 large (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-mushroom-button',   'Mushroom (Button / Khumb)',          NULL, 100,'1 cup sliced (100g)',        22,  3.1,  3.3,  0.3,  1.0,
   '[{"unit":"katori","grams":80,"label":"Katori sliced (80g)"},{"unit":"katori","grams":100,"label":"Large katori (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-baby-corn',         'Baby Corn (Chhote Makai)',           NULL, 100,'1 cup (100g)',               26,  2.3,  5.5,  0.2,  2.9,
   '[{"unit":"katori","grams":80,"label":"Katori (80g)"},{"unit":"katori","grams":100,"label":"Large katori (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-broccoli',          'Broccoli (Hari Phool Gobi)',         NULL, 100,'1 cup florets (100g)',        34,  2.8,  6.6,  0.4,  2.6,
   '[{"unit":"katori","grams":80,"label":"Katori (80g)"},{"unit":"katori","grams":100,"label":"Large katori (100g)"},{"unit":"katori","grams":150,"label":"Big katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-spring-onion',      'Spring Onion / Green Onion (Hara Pyaz)',NULL,50,'½ cup chopped (50g)',       32,  1.8,  7.3,  0.2,  2.6,
   '[{"unit":"tablespoon","grams":15,"label":"1 tbsp chopped (15g)"},{"unit":"handful","grams":50,"label":"½ cup chopped (50g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-capsicum-yellow',   'Yellow Capsicum (Peela Shimla Mirch)',NULL,100,'1 medium (100g)',             27,  1.0,  5.2,  0.2,  1.7,
   '[{"unit":"medium","grams":100,"label":"1 medium (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-raw-banana',        'Raw Banana / Plantain (Kela, Kacha)',NULL,100,'1 medium raw banana (100g)', 89,  1.3, 22.0,  0.1,  2.0,
   '[{"unit":"piece","grams":80,"label":"1 small raw banana (80g)"},{"unit":"piece","grams":100,"label":"1 medium raw banana (100g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-green-peas-raw',    'Green Peas Raw (Hara Matar, Shelled)',NULL,100,'½ cup shelled (100g)',       81,  5.4, 13.8,  0.4,  5.1,
   '[{"unit":"katori","grams":100,"label":"Katori shelled (100g)"},{"unit":"katori","grams":150,"label":"Large katori (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-okra-raw',          'Bhindi / Okra (Raw)',                NULL, 100,'8–10 pieces (100g)',          35,  2.1,  5.8,  0.1,  3.2,
   '[{"unit":"piece","grams":10,"label":"1 okra (10g)"},{"unit":"katori","grams":100,"label":"8-10 pieces (100g)"},{"unit":"katori","grams":150,"label":"12-15 pieces (150g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── MORE DAIRY & MILK PRODUCTS ────────────────────────────────────────────────
  ('ifct','ifct-condensed-milk',    'Condensed Milk (Sweetened)',         NULL,  40,'2 tbsp (40g)',              321,  8.0, 55.0,  8.7,  0.0,
   '[{"unit":"tablespoon","grams":20,"label":"1 tbsp (20g)"},{"unit":"tablespoon","grams":40,"label":"2 tbsp (40g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-malai',             'Malai / Fresh Cream',               NULL,  20,'1 tbsp (20g)',              220,  2.5,  3.5, 22.0,  0.0,
   '[{"unit":"tablespoon","grams":15,"label":"1 tbsp (15g)"},{"unit":"tablespoon","grams":30,"label":"2 tbsp (30g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-mozzarella',        'Mozzarella Cheese',                 NULL,  30,'1 slice / 30g',              280, 20.0,  2.2, 22.0,  0.0,
   '[{"unit":"slice","grams":30,"label":"1 slice (30g)"},{"unit":"slice","grams":60,"label":"2 slices (60g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-amul-butter-unsalted','Amul Unsalted Butter',            'Amul', 10,'1 tsp (10g)',              717,  0.9,  0.1, 81.0,  0.0,
   '[{"unit":"teaspoon","grams":5,"label":"½ tsp (5g)"},{"unit":"teaspoon","grams":10,"label":"1 tsp (10g)"},{"unit":"tablespoon","grams":14,"label":"1 tbsp (14g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── MEALS / COMBOS ─────────────────────────────────────────────────────────────
  ('ifct','ifct-poori-bhaji',       'Poori Bhaji (2 pooris + aloo bhaji)',NULL, 250,'1 plate (250g)',            320,  6.5, 52.0, 10.0,  2.5,
   '[{"unit":"plate","grams":200,"label":"Small plate (200g)"},{"unit":"plate","grams":250,"label":"Plate (250g)"},{"unit":"plate","grams":350,"label":"Large plate (350g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-chole-rice',        'Chole Chawal (Chole + Rice)',        NULL, 350,'1 plate (350g)',            155,  7.0, 28.0,  2.5,  4.5,
   '[{"unit":"plate","grams":300,"label":"Small plate (300g)"},{"unit":"plate","grams":350,"label":"Plate (350g)"},{"unit":"plate","grams":450,"label":"Large plate (450g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-thali-veg',         'Veg Thali (Dal + Sabzi + Rice + Roti)',NULL,500,'1 thali (500g)',           195,  8.5, 35.0,  3.5,  3.0,
   '[{"unit":"thali","grams":400,"label":"Small thali (400g)"},{"unit":"thali","grams":500,"label":"Thali (500g)"},{"unit":"thali","grams":650,"label":"Large thali (650g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-thali-nonveg',      'Non-Veg Thali (Chicken + Dal + Rice + Roti)',NULL,550,'1 thali (550g)',    225, 15.0, 32.0,  6.0,  2.5,
   '[{"unit":"thali","grams":450,"label":"Small thali (450g)"},{"unit":"thali","grams":550,"label":"Thali (550g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  ('ifct','ifct-meals-south-indian','South Indian Meals (Unlimited)',     NULL, 600,'1 plate (600g)',            172,  6.0, 32.0,  3.0,  2.5,
   '[{"unit":"plate","grams":500,"label":"Small plate (500g)"},{"unit":"plate","grams":600,"label":"Plate (600g)"},{"unit":"gram","grams":100,"label":"100g"}]'),

  -- ── BEVERAGES (missing) ────────────────────────────────────────────────────────
  ('ifct','ifct-masala-milk',       'Masala Milk (Spiced Milk)',          NULL, 200,'1 glass (200ml)',            85,  3.5, 10.5,  3.0,  0.2,
   '[{"unit":"glass","grams":150,"label":"Small glass (150ml)"},{"unit":"glass","grams":200,"label":"Glass (200ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('ifct','ifct-green-tea',         'Green Tea (Unsweetened)',            NULL, 200,'1 cup (200ml)',               2,  0.0,  0.2,  0.0,  0.0,
   '[{"unit":"cup","grams":200,"label":"1 cup (200ml)"},{"unit":"gram","grams":100,"label":"100ml"}]'),

  ('ifct','ifct-protein-shake',     'Protein Shake (Whey + Milk)',        NULL, 300,'1 glass (300ml)',           185, 25.0, 12.0,  4.0,  0.5,
   '[{"unit":"glass","grams":250,"label":"Small glass (250ml)"},{"unit":"glass","grams":300,"label":"Glass (300ml)"},{"unit":"gram","grams":100,"label":"100ml"}]')

ON CONFLICT (source, source_id) DO NOTHING;

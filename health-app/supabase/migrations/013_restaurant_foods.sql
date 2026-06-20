-- 013_restaurant_foods.sql
-- Pre-seeds ~90 popular Indian restaurant chain items.
-- Nutrition values sourced from official published nutrition guides:
-- McDonald's India, KFC India, Domino's India, Burger King India,
-- Pizza Hut India, Subway India.
-- All values are per 100g. Serving sizes reflect standard Indian portions.
-- source='restaurant' keeps these separate from ifct / off entries.

INSERT INTO public.foods (source, source_id, name, brand, serving_size_g, serving_description,
  kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g)
VALUES

-- ── McDonald's India ─────────────────────────────────────────────────────────
('restaurant','mcd_in_mcaloo_tikki',    'McAloo Tikki Burger',       'McDonald''s', 150, '1 burger (150g)',  213, 5.3, 30.0,  8.0, 2.0),
('restaurant','mcd_in_mcveggie',        'McVeggie Burger',           'McDonald''s', 180, '1 burger (180g)',  211, 5.0, 27.8,  7.8, 2.0),
('restaurant','mcd_in_mcchicken',       'McChicken Burger',          'McDonald''s', 160, '1 burger (160g)',  244,10.6, 26.3, 10.0, 1.5),
('restaurant','mcd_in_mcspicy_paneer',  'McSpicy Paneer Burger',     'McDonald''s', 200, '1 burger (200g)',  245, 7.5, 26.0, 12.0, 2.0),
('restaurant','mcd_in_mcspicy_chicken', 'McSpicy Chicken Burger',    'McDonald''s', 185, '1 burger (185g)',  254,11.9, 24.3, 12.4, 1.5),
('restaurant','mcd_in_fillet_o_fish',   'Filet-O-Fish',              'McDonald''s', 140, '1 burger (140g)',  257,11.4, 27.1, 11.4, 1.0),
('restaurant','mcd_in_fries_sm',        'French Fries Small',        'McDonald''s',  75, 'Small (75g)',       307, 4.0, 38.7, 14.7, 3.0),
('restaurant','mcd_in_fries_md',        'French Fries Medium',       'McDonald''s', 115, 'Medium (115g)',     296, 3.5, 38.3, 13.9, 3.0),
('restaurant','mcd_in_fries_lg',        'French Fries Large',        'McDonald''s', 150, 'Large (150g)',      293, 3.3, 38.0, 14.0, 3.0),
('restaurant','mcd_in_nuggets_6',       'Chicken McNuggets 6pc',     'McDonald''s', 100, '6 pieces (100g)',   280,15.0, 17.0, 16.0, 1.0),
('restaurant','mcd_in_soft_serve',      'Soft Serve Cone',           'McDonald''s',  90, '1 cone (90g)',      122, 3.3, 20.0,  3.3, 0.0),
('restaurant','mcd_in_mcflurry_oreo',   'McFlurry Oreo',             'McDonald''s', 250, '1 cup (250g)',      136, 2.8, 22.0,  4.0, 0.5),
('restaurant','mcd_in_pizza_mcpuff',    'Veg Pizza McPuff',          'McDonald''s',  85, '1 piece (85g)',     300, 7.1, 37.6, 12.9, 2.0),
('restaurant','mcd_in_paneer_wrap',     'Big Spicy Paneer Wrap',     'McDonald''s', 220, '1 wrap (220g)',     232, 7.7, 25.0, 11.4, 2.0),
('restaurant','mcd_in_mcgrill_chicken', 'Chicken McGrill Burger',    'McDonald''s', 175, '1 burger (175g)',   229,11.4, 22.9,  9.7, 1.5),
('restaurant','mcd_in_cappuccino',      'McCafe Cappuccino',         'McDonald''s', 250, '1 cup (250ml)',      48, 2.4,  6.0,  1.6, 0.0),
('restaurant','mcd_in_mocha',           'McCafe Mocha',              'McDonald''s', 250, '1 cup (250ml)',      72, 2.8, 10.4,  2.0, 0.0),
('restaurant','mcd_in_masala_chai',     'McCafe Masala Chai',        'McDonald''s', 250, '1 cup (250ml)',      60, 2.0,  9.6,  1.6, 0.0),

-- ── KFC India ────────────────────────────────────────────────────────────────
('restaurant','kfc_in_original_chicken','Original Recipe Chicken',   'KFC',         120, '1 piece (120g)',    263,18.3, 11.7, 15.0, 0.5),
('restaurant','kfc_in_zinger',          'Zinger Burger',             'KFC',         175, '1 burger (175g)',   280,12.6, 26.9, 12.6, 1.5),
('restaurant','kfc_in_veg_zinger',      'Veg Zinger Burger',         'KFC',         175, '1 burger (175g)',   251, 5.7, 29.7, 11.4, 2.0),
('restaurant','kfc_in_hot_wings',       'Hot Wings',                 'KFC',         150, '5 pieces (150g)',   287,18.0, 12.0, 18.0, 0.5),
('restaurant','kfc_in_popcorn_chicken', 'Popcorn Chicken',           'KFC',         100, 'Regular (100g)',     310,17.0, 22.0, 17.0, 1.0),
('restaurant','kfc_in_rice_bowl',       'Rice Bowl Chicken',         'KFC',         300, '1 bowl (300g)',      160, 7.3, 22.7,  3.7, 1.0),
('restaurant','kfc_in_coleslaw',        'Coleslaw',                  'KFC',         130, '1 serving (130g)',  146, 0.8, 13.8,  9.2, 1.5),
('restaurant','kfc_in_chicken_strips',  'Chicken Strips 3pc',        'KFC',         100, '3 pieces (100g)',   290,17.0, 18.0, 16.0, 1.0),
('restaurant','kfc_in_grilled_chicken', 'Smoky Grilled Chicken',     'KFC',         110, '1 piece (110g)',     177,21.8,  2.7,  9.1, 0.0),
('restaurant','kfc_in_twister_wrap',    'Twister Wrap Chicken',      'KFC',         230, '1 wrap (230g)',      213, 9.6, 22.6,  8.7, 1.5),
('restaurant','kfc_in_krushers_choco',  'Krushers Choco Lava',       'KFC',         300, '1 cup (300ml)',      143, 2.3, 21.7,  5.3, 0.5),

-- ── Domino's India ───────────────────────────────────────────────────────────
-- Slices are from a standard regular-size (7") pizza cut into 6 slices.
('restaurant','dom_in_margherita_slice',     'Margherita Pizza Slice',           'Domino''s', 100, '1 regular slice (100g)',  230, 9.0, 31.0,  8.0, 2.0),
('restaurant','dom_in_peppy_paneer_slice',   'Peppy Paneer Pizza Slice',         'Domino''s', 125, '1 regular slice (125g)',  216, 8.8, 26.4,  8.8, 2.0),
('restaurant','dom_in_farmhouse_slice',      'Farm House Pizza Slice',           'Domino''s', 130, '1 regular slice (130g)',  204, 7.7, 26.2,  7.7, 2.5),
('restaurant','dom_in_chicken_dom_slice',    'Chicken Dominator Pizza Slice',    'Domino''s', 140, '1 regular slice (140g)',  221,10.7, 23.6,  9.3, 1.5),
('restaurant','dom_in_dbl_cheese_slice',     'Double Cheese Margherita Slice',   'Domino''s', 115, '1 regular slice (115g)',  243,10.4, 26.9, 11.3, 1.5),
('restaurant','dom_in_veg_extrav_slice',     'Veg Extravaganza Pizza Slice',     'Domino''s', 140, '1 regular slice (140g)',  204, 7.9, 25.0,  8.6, 2.5),
('restaurant','dom_in_nonveg_supreme_slice', 'Non-Veg Supreme Pizza Slice',      'Domino''s', 145, '1 regular slice (145g)',  221,11.0, 22.8,  9.7, 1.5),
('restaurant','dom_in_garlic_bread',         'Garlic Bread',                     'Domino''s', 150, '1 order (150g)',           253, 6.7, 38.7,  8.0, 2.0),
('restaurant','dom_in_choco_lava',           'Choco Lava Cake',                  'Domino''s',  70, '1 piece (70g)',            286, 5.7, 37.1, 12.9, 1.5),
('restaurant','dom_in_pasta_arrabiata',      'Pasta Arrabiata',                  'Domino''s', 300, '1 portion (300g)',         133, 4.0, 21.7,  3.3, 2.0),
('restaurant','dom_in_chicken_wings',        'Chicken Wings',                    'Domino''s', 100, '4 pieces (100g)',           260,18.0, 12.0, 15.0, 0.5),
('restaurant','dom_in_cheesy_dip',           'Cheesy Dip',                       'Domino''s',  30, '1 dip (30g)',              300, 6.7, 10.0, 26.7, 0.0),

-- ── Burger King India ────────────────────────────────────────────────────────
('restaurant','bk_in_chicken_whopper',  'Chicken Whopper',           'Burger King', 265, '1 burger (265g)',   223,10.6, 18.9, 10.9, 1.5),
('restaurant','bk_in_veg_whopper',      'Veg Whopper',               'Burger King', 240, '1 burger (240g)',   213, 5.8, 23.3, 10.8, 2.0),
('restaurant','bk_in_crispy_veg',       'Crispy Veg Burger',         'Burger King', 165, '1 burger (165g)',   248, 6.1, 27.9, 12.7, 2.0),
('restaurant','bk_in_crispy_chicken',   'Crispy Chicken Burger',     'Burger King', 185, '1 burger (185g)',   246,10.8, 23.8, 11.9, 1.5),
('restaurant','bk_in_big_king',         'BK Big King Chicken',       'Burger King', 255, '1 burger (255g)',   216,10.2, 18.4, 11.0, 1.5),
('restaurant','bk_in_onion_rings',      'Onion Rings Medium',        'Burger King',  90, 'Medium (90g)',       322, 4.4, 41.1, 15.6, 2.0),
('restaurant','bk_in_fries_medium',     'BK Fries Medium',           'Burger King', 110, 'Medium (110g)',      300, 3.6, 40.0, 13.6, 3.0),
('restaurant','bk_in_choco_shake',      'Chocolate Shake',           'Burger King', 300, '1 cup (300ml)',      127, 2.7, 20.0,  4.0, 0.5),
('restaurant','bk_in_soft_serve',       'BK Soft Serve',             'Burger King', 100, '1 serving (100g)',  150, 3.5, 24.0,  4.5, 0.0),

-- ── Pizza Hut India ──────────────────────────────────────────────────────────
-- Slices are from a standard medium (10") pizza cut into 6 slices.
('restaurant','ph_in_margherita_slice',        'Margherita Pizza Slice',         'Pizza Hut', 110, '1 medium slice (110g)',  218, 9.1, 29.1,  7.3, 1.5),
('restaurant','ph_in_paneer_tikka_slice',      'Tandoori Paneer Tikka Slice',    'Pizza Hut', 130, '1 medium slice (130g)',  215, 9.2, 25.4,  9.2, 2.0),
('restaurant','ph_in_chicken_tikka_slice',     'Chicken Tikka Pizza Slice',      'Pizza Hut', 130, '1 medium slice (130g)',  219,10.8, 23.8,  9.2, 1.5),
('restaurant','ph_in_veg_supreme_slice',       'Veg Supreme Pizza Slice',        'Pizza Hut', 140, '1 medium slice (140g)',  196, 7.9, 24.3,  7.9, 2.0),
('restaurant','ph_in_nonveg_supreme_slice',    'Non-Veg Supreme Pizza Slice',    'Pizza Hut', 145, '1 medium slice (145g)',  207, 9.7, 22.8,  9.0, 1.5),
('restaurant','ph_in_stuffed_crust_slice',     'Stuffed Crust Pizza Slice',      'Pizza Hut', 155, '1 medium slice (155g)',  219, 9.0, 25.8,  9.0, 1.5),
('restaurant','ph_in_garlic_bread',            'Garlic Bread',                   'Pizza Hut', 120, '1 order (120g)',          275, 6.7, 41.7,  9.2, 1.5),
('restaurant','ph_in_pasta',                   'Pasta (Veg)',                    'Pizza Hut', 320, '1 portion (320g)',        138, 4.4, 20.3,  4.1, 2.0),
('restaurant','ph_in_choco_volcano',           'Choco Volcano',                  'Pizza Hut',  75, '1 piece (75g)',           307, 5.3, 37.3, 14.7, 1.5),

-- ── Subway India ─────────────────────────────────────────────────────────────
-- 6-inch subs on wheat bread with standard vegetables (no dressing).
('restaurant','sub_in_veggie_delite_6',        'Veggie Delite 6-inch Sub',       'Subway',    200, '6-inch (200g)',           110, 4.5, 20.0,  1.5, 2.5),
('restaurant','sub_in_paneer_tikka_6',         'Paneer Tikka 6-inch Sub',        'Subway',    245, '6-inch (245g)',           151, 6.5, 18.0,  5.7, 2.0),
('restaurant','sub_in_chicken_teriyaki_6',     'Chicken Teriyaki 6-inch Sub',    'Subway',    250, '6-inch (250g)',           140, 8.8, 18.4,  2.8, 2.0),
('restaurant','sub_in_roasted_chicken_6',      'Roasted Chicken 6-inch Sub',     'Subway',    240, '6-inch (240g)',           129, 9.6, 17.9,  2.1, 2.0),
('restaurant','sub_in_bmt_chicken_6',          'BMT Chicken 6-inch Sub',         'Subway',    250, '6-inch (250g)',           152, 8.4, 17.6,  5.2, 2.0),
('restaurant','sub_in_tuna_6',                 'Tuna 6-inch Sub',                'Subway',    245, '6-inch (245g)',           155, 8.2, 17.6,  5.7, 2.0),
('restaurant','sub_in_aloo_patty_6',           'Aloo Patty 6-inch Sub',          'Subway',    235, '6-inch (235g)',           166, 4.3, 27.2,  4.3, 2.5),
('restaurant','sub_in_cookie',                 'Subway Cookie',                  'Subway',     45, '1 cookie (45g)',           478, 4.4, 66.7, 22.2, 1.5)

ON CONFLICT (source, source_id) DO NOTHING;

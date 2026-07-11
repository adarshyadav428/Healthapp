/**
 * Single source of truth for Indian food portion→gram conversions, shared by
 * the camera (photo) and chat (text) AI logging prompts. Previously each
 * prompt hardcoded its own table and they disagreed (e.g. 1 roti = 40g in
 * the camera prompt vs 35g in the chat prompt), so the same food gave
 * different macros depending on which entry path the user logged it from.
 */
export const INDIAN_PORTION_REFERENCE = `INDIAN PORTION SIZE REFERENCE (grams unless noted) — use these as baselines:
- Chapati / roti / phulka (medium): 1 piece = 40g
- Roti (large) / tandoori roti: 1 piece = 60g
- Paratha (plain): 1 piece = 85g
- Naan: 1 piece = 90g
- Puri: 1 piece = 30g
- Idli: 1 piece = 45g
- Dosa (plain): 1 piece = 110g
- Medu vada: 1 piece = 55g
- Samosa: 1 piece = 115g
- Kachori: 1 piece = 80g
- Vada pav: 1 piece = 145g
- Pav bhaji: 1 plate = 280g
- Rice (cooked, plain): 1 katori = 150g | 1 home plate = 200g | 1 restaurant plate = 300g
- Biryani / pulao: 1 katori = 180g | 1 home plate = 300g | 1 restaurant plate = 420g
- Khichdi: 1 katori = 200g
- Poha / upma: 1 plate = 200g
- Dal / sambar / curry (liquid-based): 1 katori = 150g | 1 bowl = 250g
- Dry sabzi (potato, mixed veg): 1 katori = 110g
- Paneer dish (e.g. paneer butter masala): 1 katori = 160g
- Chole / rajma / dal makhani: 1 katori = 150g
- Curd / raita: 1 katori = 120g
- Chai / coffee (with milk): 1 cup = 150ml
- Lassi (sweet): 1 glass = 250ml
- Milk: 1 glass = 200ml
- Ghee / oil: 1 tablespoon = 12g
- Sugar / honey: 1 tablespoon = 15g
- Egg: 1 = 50g
- Banana (medium): 1 = 120g
- Apple / orange (medium): 1 = 150g
- Bread: 1 slice = 30g
- Gulab jamun: 1 piece = 50g
- Jalebi: 1 piece = 35g
- Rasgulla: 1 piece = 60g`

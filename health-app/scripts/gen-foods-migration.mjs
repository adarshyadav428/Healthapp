/**
 * Generates supabase/migrations/009_seed_indian_foods_v2.sql
 * Run: node scripts/gen-foods-migration.mjs
 */
import { writeFileSync } from 'fs'

const foods = [
  // BREAKFAST STAPLES
  { name: "Poha (cooked)",              cal: 130, protein: 2.5,  carbs: 27.0, fat: 1.5,  fiber: 0.8,  portion: "1 plate",    grams: 200 },
  { name: "Upma",                        cal: 145, protein: 3.2,  carbs: 26.0, fat: 3.8,  fiber: 1.2,  portion: "1 plate",    grams: 200 },
  { name: "Aloo paratha",                cal: 249, protein: 5.5,  carbs: 38.0, fat: 9.0,  fiber: 2.5,  portion: "1 piece",    grams: 120 },
  { name: "Gobhi paratha",               cal: 238, protein: 6.0,  carbs: 36.0, fat: 8.5,  fiber: 3.0,  portion: "1 piece",    grams: 120 },
  { name: "Dosa (plain)",                cal: 168, protein: 3.9,  carbs: 32.0, fat: 3.2,  fiber: 1.0,  portion: "1 piece",    grams: 100 },
  { name: "Uttapam",                     cal: 178, protein: 4.5,  carbs: 32.0, fat: 4.0,  fiber: 1.5,  portion: "1 piece",    grams: 120 },
  { name: "Medu vada",                   cal: 322, protein: 9.5,  carbs: 38.0, fat: 15.0, fiber: 2.5,  portion: "1 piece",    grams: 80  },
  { name: "Dhokla",                      cal: 160, protein: 5.5,  carbs: 28.0, fat: 3.2,  fiber: 1.8,  portion: "4 pieces",   grams: 100 },
  { name: "Oats (cooked with water)",    cal: 71,  protein: 2.5,  carbs: 12.0, fat: 1.4,  fiber: 1.7,  portion: "1 bowl",     grams: 200 },
  { name: "Cornflakes with milk",        cal: 148, protein: 5.2,  carbs: 28.0, fat: 2.2,  fiber: 0.5,  portion: "1 bowl",     grams: 200 },
  // DALS
  { name: "Toor dal (cooked)",           cal: 116, protein: 7.2,  carbs: 20.0, fat: 0.4,  fiber: 3.6,  portion: "1 katori",   grams: 150 },
  { name: "Masoor dal (cooked)",         cal: 102, protein: 7.6,  carbs: 17.0, fat: 0.4,  fiber: 3.5,  portion: "1 katori",   grams: 150 },
  { name: "Urad dal (cooked)",           cal: 118, protein: 7.6,  carbs: 21.0, fat: 0.4,  fiber: 1.5,  portion: "1 katori",   grams: 150 },
  { name: "Chana dal (cooked)",          cal: 164, protein: 8.9,  carbs: 27.0, fat: 2.7,  fiber: 8.0,  portion: "1 katori",   grams: 150 },
  { name: "Dal makhani",                 cal: 145, protein: 7.5,  carbs: 18.5, fat: 4.8,  fiber: 4.2,  portion: "1 katori",   grams: 150 },
  { name: "Dal tadka",                   cal: 120, protein: 6.8,  carbs: 17.0, fat: 3.2,  fiber: 3.0,  portion: "1 katori",   grams: 150 },
  { name: "Dal baati",                   cal: 412, protein: 10.5, carbs: 58.0, fat: 16.0, fiber: 3.8,  portion: "1 serving",  grams: 200 },
  // SABZIS
  { name: "Aloo sabzi (dry)",            cal: 148, protein: 2.5,  carbs: 24.0, fat: 5.0,  fiber: 2.5,  portion: "1 katori",   grams: 150 },
  { name: "Palak paneer",                cal: 178, protein: 8.5,  carbs: 8.0,  fat: 13.0, fiber: 3.2,  portion: "1 katori",   grams: 150 },
  { name: "Matar paneer",                cal: 195, protein: 9.0,  carbs: 12.0, fat: 13.5, fiber: 3.0,  portion: "1 katori",   grams: 150 },
  { name: "Bhindi masala",               cal: 98,  protein: 2.8,  carbs: 10.5, fat: 5.2,  fiber: 3.5,  portion: "1 katori",   grams: 150 },
  { name: "Baingan bharta",              cal: 82,  protein: 2.2,  carbs: 9.5,  fat: 4.0,  fiber: 3.0,  portion: "1 katori",   grams: 150 },
  { name: "Aloo gobi",                   cal: 112, protein: 2.8,  carbs: 16.0, fat: 4.5,  fiber: 3.0,  portion: "1 katori",   grams: 150 },
  { name: "Saag (sarson da saag)",       cal: 95,  protein: 3.8,  carbs: 8.5,  fat: 4.8,  fiber: 4.5,  portion: "1 katori",   grams: 150 },
  { name: "Shahi paneer",                cal: 248, protein: 10.0, carbs: 12.0, fat: 18.5, fiber: 1.5,  portion: "1 katori",   grams: 150 },
  // NON-VEG
  { name: "Chicken curry (home-cooked)", cal: 165, protein: 18.5, carbs: 4.5,  fat: 8.5,  fiber: 0.8,  portion: "1 katori",   grams: 150 },
  { name: "Butter chicken",              cal: 198, protein: 17.0, carbs: 8.0,  fat: 12.0, fiber: 1.0,  portion: "1 katori",   grams: 150 },
  { name: "Tandoori chicken",            cal: 190, protein: 22.0, carbs: 4.0,  fat: 9.5,  fiber: 0.5,  portion: "1 piece",    grams: 120 },
  { name: "Egg bhurji (2 eggs)",         cal: 218, protein: 14.0, carbs: 4.5,  fat: 16.0, fiber: 0.5,  portion: "1 serving",  grams: 120 },
  { name: "Omelette (2 eggs)",           cal: 200, protein: 13.5, carbs: 1.5,  fat: 15.5, fiber: 0.0,  portion: "1 piece",    grams: 110 },
  { name: "Fish curry",                  cal: 142, protein: 16.5, carbs: 5.0,  fat: 6.5,  fiber: 0.8,  portion: "1 katori",   grams: 150 },
  { name: "Mutton curry",                cal: 218, protein: 18.0, carbs: 4.5,  fat: 14.5, fiber: 0.8,  portion: "1 katori",   grams: 150 },
  { name: "Keema (minced meat)",         cal: 245, protein: 22.0, carbs: 5.5,  fat: 15.5, fiber: 1.0,  portion: "1 katori",   grams: 150 },
  // SOUTH INDIAN
  { name: "Sambhar",                     cal: 62,  protein: 3.2,  carbs: 10.0, fat: 1.2,  fiber: 2.8,  portion: "1 katori",   grams: 150 },
  { name: "Rasam",                       cal: 28,  protein: 1.2,  carbs: 5.0,  fat: 0.4,  fiber: 1.0,  portion: "1 katori",   grams: 150 },
  { name: "Coconut chutney",             cal: 198, protein: 2.5,  carbs: 8.5,  fat: 18.0, fiber: 4.5,  portion: "2 tbsp",     grams: 30  },
  { name: "Idli",                        cal: 116, protein: 4.0,  carbs: 24.0, fat: 0.8,  fiber: 1.0,  portion: "1 piece",    grams: 50  },
  // DRINKS
  { name: "Chai with milk and sugar",    cal: 54,  protein: 1.5,  carbs: 8.5,  fat: 1.5,  fiber: 0.0,  portion: "1 cup",      grams: 150 },
  { name: "Black coffee (no sugar)",     cal: 5,   protein: 0.3,  carbs: 0.7,  fat: 0.1,  fiber: 0.0,  portion: "1 cup",      grams: 150 },
  { name: "Nimbu pani (sweetened)",      cal: 42,  protein: 0.2,  carbs: 11.0, fat: 0.1,  fiber: 0.2,  portion: "1 glass",    grams: 250 },
  { name: "Coconut water",               cal: 24,  protein: 0.4,  carbs: 5.5,  fat: 0.1,  fiber: 0.3,  portion: "1 glass",    grams: 250 },
  { name: "Mango shake",                 cal: 128, protein: 3.5,  carbs: 24.0, fat: 2.5,  fiber: 0.8,  portion: "1 glass",    grams: 300 },
  { name: "Turmeric milk (haldi doodh)", cal: 85,  protein: 4.0,  carbs: 9.5,  fat: 3.5,  fiber: 0.2,  portion: "1 glass",    grams: 250 },
  // NUTS / FATS
  { name: "Ghee",                        cal: 900, protein: 0.0,  carbs: 0.0,  fat: 99.7, fiber: 0.0,  portion: "1 tsp",      grams: 5   },
  { name: "Mustard oil",                 cal: 884, protein: 0.0,  carbs: 0.0,  fat: 100,  fiber: 0.0,  portion: "1 tsp",      grams: 5   },
  { name: "Almonds (raw)",               cal: 579, protein: 21.0, carbs: 22.0, fat: 50.0, fiber: 12.5, portion: "10 pieces",  grams: 14  },
  { name: "Cashews (raw)",               cal: 553, protein: 18.0, carbs: 33.0, fat: 44.0, fiber: 3.3,  portion: "10 pieces",  grams: 14  },
  { name: "Peanuts (roasted)",           cal: 587, protein: 26.0, carbs: 21.0, fat: 50.0, fiber: 8.5,  portion: "1 handful",  grams: 30  },
  { name: "Sesame seeds (til)",          cal: 573, protein: 17.7, carbs: 23.5, fat: 49.7, fiber: 11.8, portion: "1 tbsp",     grams: 10  },
  // FRUITS
  { name: "Banana (medium)",             cal: 89,  protein: 1.1,  carbs: 22.8, fat: 0.3,  fiber: 2.6,  portion: "1 medium",   grams: 120 },
  { name: "Mango (Alphonso)",            cal: 70,  protein: 0.8,  carbs: 17.0, fat: 0.3,  fiber: 1.8,  portion: "1 katori",   grams: 150 },
  { name: "Papaya",                      cal: 43,  protein: 0.5,  carbs: 10.8, fat: 0.3,  fiber: 1.7,  portion: "1 katori",   grams: 150 },
  { name: "Guava",                       cal: 68,  protein: 2.6,  carbs: 14.3, fat: 1.0,  fiber: 5.4,  portion: "1 medium",   grams: 100 },
  { name: "Chikoo / Sapodilla",          cal: 94,  protein: 0.4,  carbs: 20.0, fat: 1.1,  fiber: 5.3,  portion: "1 medium",   grams: 100 },
  { name: "Watermelon",                  cal: 30,  protein: 0.6,  carbs: 7.6,  fat: 0.2,  fiber: 0.4,  portion: "1 katori",   grams: 200 },
  // SNACKS
  { name: "Mathri",                      cal: 462, protein: 8.0,  carbs: 58.0, fat: 22.0, fiber: 2.5,  portion: "4 pieces",   grams: 50  },
  { name: "Namkeen (mixed)",             cal: 525, protein: 10.0, carbs: 55.0, fat: 30.0, fiber: 3.0,  portion: "1 handful",  grams: 30  },
  { name: "Murukku",                     cal: 496, protein: 8.5,  carbs: 64.0, fat: 23.0, fiber: 3.5,  portion: "3 pieces",   grams: 40  },
  { name: "Chivda (poha chivda)",        cal: 418, protein: 8.0,  carbs: 65.0, fat: 14.0, fiber: 3.0,  portion: "1 handful",  grams: 40  },
  // SWEETS
  { name: "Kheer (rice)",                cal: 180, protein: 4.5,  carbs: 30.0, fat: 5.5,  fiber: 0.3,  portion: "1 katori",   grams: 150 },
  { name: "Besan barfi",                 cal: 452, protein: 9.5,  carbs: 58.0, fat: 20.0, fiber: 2.0,  portion: "1 piece",    grams: 40  },
  { name: "Peda",                        cal: 420, protein: 8.5,  carbs: 62.0, fat: 16.0, fiber: 0.0,  portion: "1 piece",    grams: 35  },
  { name: "Gajar halwa",                 cal: 268, protein: 4.2,  carbs: 40.0, fat: 10.5, fiber: 2.8,  portion: "1 katori",   grams: 100 },
  // CONDIMENTS
  { name: "Mango pickle (achaar)",       cal: 142, protein: 1.2,  carbs: 12.0, fat: 9.5,  fiber: 2.0,  portion: "1 tsp",      grams: 10  },
  { name: "Raita (plain)",               cal: 62,  protein: 3.0,  carbs: 5.5,  fat: 3.0,  fiber: 0.5,  portion: "1 katori",   grams: 100 },
  { name: "Green chutney",               cal: 68,  protein: 2.5,  carbs: 8.0,  fat: 3.0,  fiber: 4.0,  portion: "2 tbsp",     grams: 30  },
]

// Build common_portions JSON based on portion type
function buildPortions(portion, grams) {
  switch (portion) {
    case '1 plate':
      return JSON.stringify([
        { unit: 'plate', grams: Math.round(grams * 0.75), label: `Small plate (${Math.round(grams * 0.75)}g)` },
        { unit: 'plate', grams,                           label: `Medium plate (${grams}g)` },
        { unit: 'plate', grams: Math.round(grams * 1.5),  label: `Large plate (${Math.round(grams * 1.5)}g)` },
        { unit: 'gram',  grams: 100,                      label: '100g' },
      ])
    case '1 katori':
      return JSON.stringify([
        { unit: 'katori', grams: Math.round(grams * 0.75), label: `Small katori (${Math.round(grams * 0.75)}g)` },
        { unit: 'katori', grams,                            label: `Katori (${grams}g)` },
        { unit: 'katori', grams: Math.round(grams * 1.5),  label: `Large katori (${Math.round(grams * 1.5)}g)` },
        { unit: 'gram',   grams: 100,                      label: '100g' },
      ])
    case '1 piece':
    case '4 pieces':
    case '3 pieces':
    case '4 pieces':
      return JSON.stringify([
        { unit: 'piece', grams,          label: `1 piece (${grams}g)` },
        { unit: 'piece', grams: grams*2, label: `2 pieces (${grams*2}g)` },
        { unit: 'gram',  grams: 100,     label: '100g' },
      ])
    case '1 bowl':
      return JSON.stringify([
        { unit: 'bowl', grams: Math.round(grams * 0.75), label: `Small bowl (${Math.round(grams * 0.75)}g)` },
        { unit: 'bowl', grams,                            label: `Bowl (${grams}g)` },
        { unit: 'gram', grams: 100,                       label: '100g' },
      ])
    case '1 glass':
      return JSON.stringify([
        { unit: 'glass', grams,           label: `1 glass (${grams}ml)` },
        { unit: 'glass', grams: grams*2,  label: `2 glasses (${grams*2}ml)` },
        { unit: 'gram',  grams: 100,      label: '100ml' },
      ])
    case '1 cup':
      return JSON.stringify([
        { unit: 'cup',  grams,       label: `1 cup (${grams}ml)` },
        { unit: 'cup',  grams: grams*2, label: `2 cups (${grams*2}ml)` },
        { unit: 'gram', grams: 100,  label: '100ml' },
      ])
    case '1 tsp':
      return JSON.stringify([
        { unit: 'tsp',  grams,       label: `1 tsp (${grams}g)` },
        { unit: 'tbsp', grams: grams*3, label: `1 tbsp (${grams*3}g)` },
        { unit: 'gram', grams: 100,  label: '100g' },
      ])
    case '1 tbsp':
      return JSON.stringify([
        { unit: 'tbsp', grams,       label: `1 tbsp (${grams}g)` },
        { unit: 'tbsp', grams: grams*2, label: `2 tbsp (${grams*2}g)` },
        { unit: 'gram', grams: 100,  label: '100g' },
      ])
    case '2 tbsp':
      return JSON.stringify([
        { unit: 'tbsp', grams: grams/2, label: `1 tbsp (${grams/2}g)` },
        { unit: 'tbsp', grams,          label: `2 tbsp (${grams}g)` },
        { unit: 'gram', grams: 100,     label: '100g' },
      ])
    case '1 serving':
      return JSON.stringify([
        { unit: 'serving', grams,          label: `1 serving (${grams}g)` },
        { unit: 'serving', grams: grams*2, label: `2 servings (${grams*2}g)` },
        { unit: 'gram',    grams: 100,     label: '100g' },
      ])
    case '10 pieces':
      return JSON.stringify([
        { unit: 'piece', grams: Math.round(grams/10*5),  label: `5 pieces (${Math.round(grams/10*5)}g)` },
        { unit: 'piece', grams,                           label: `10 pieces (${grams}g)` },
        { unit: 'piece', grams: Math.round(grams/10*15), label: `15 pieces (${Math.round(grams/10*15)}g)` },
        { unit: 'gram',  grams: 100,                      label: '100g' },
      ])
    case '1 handful':
      return JSON.stringify([
        { unit: 'handful', grams,           label: `Small handful (${grams}g)` },
        { unit: 'handful', grams: grams*2,  label: `Large handful (${grams*2}g)` },
        { unit: 'gram',    grams: 100,      label: '100g' },
      ])
    case '1 medium':
      return JSON.stringify([
        { unit: 'piece', grams: Math.round(grams * 0.75), label: `Small (${Math.round(grams * 0.75)}g)` },
        { unit: 'piece', grams,                            label: `Medium (${grams}g)` },
        { unit: 'piece', grams: Math.round(grams * 1.25), label: `Large (${Math.round(grams * 1.25)}g)` },
        { unit: 'gram',  grams: 100,                       label: '100g' },
      ])
    default:
      return JSON.stringify([
        { unit: 'serving', grams, label: `1 serving (${grams}g)` },
        { unit: 'gram', grams: 100, label: '100g' },
      ])
  }
}

// Slug for source_id
function slug(name) {
  return 'ifct_v2_' + name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60)
}

const rows = foods.map(f => {
  const portions = buildPortions(f.portion, f.grams)
  const portionLabel = f.portion === '1 katori' ? `1 katori (${f.grams}g)` : `${f.portion} (${f.grams}g)`
  return `  ('ifct', '${slug(f.name)}', ${sqlStr(f.name)}, NULL, ${f.grams}, ${sqlStr(portionLabel)}, ${f.cal}, ${f.protein}, ${f.carbs}, ${f.fat}, ${f.fiber}, ${sqlStr(portions)})`
})

function sqlStr(s) {
  return "'" + s.replace(/'/g, "''") + "'"
}

const sql = `-- 009_seed_indian_foods_v2.sql
-- 70 additional verified Indian foods (IFCT 2017 + standard references).
-- Idempotent: ON CONFLICT (source, source_id) DO NOTHING.

INSERT INTO foods (
  source, source_id, name, brand, serving_size_g, serving_description,
  kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g,
  fiber_g_per_100g, common_portions
)
VALUES
${rows.join(',\n')}
ON CONFLICT (source, source_id) DO NOTHING;
`

writeFileSync('supabase/migrations/009_seed_indian_foods_v2.sql', sql)
console.log(`Written ${foods.length} foods to 009_seed_indian_foods_v2.sql`)

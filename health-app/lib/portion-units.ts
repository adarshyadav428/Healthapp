import type { Food } from '../types/index'

/**
 * Portion-unit engine — single source of truth for household-measure logging
 * (katori, bowl, glass, piece, plate, …) shared by AddFoodModal and
 * EditFoodLogModal. Pure module so it stays unit-testable (see
 * tests/portionUnits.test.ts).
 *
 * Precedence when building the unit list for a food:
 *   1. SMART_PORTIONS name match (works for every source — IFCT, OFF, custom)
 *   2. common_portions jsonb from the DB (IFCT migration 008)
 *   3. serving_size_g, only when it looks like a real serving (≠ 100g default)
 * Grams is always offered first and ounces last.
 */

export type Unit = { key: string; label: string; toGrams: (q: number) => number }

/**
 * Slider/number-input bounds for a portion amount, keyed by whether the item
 * is counted in discrete pieces ("pcs") or a continuous weight/volume. Shared
 * by the camera scan portion control. Pure so it stays unit-testable.
 */
export function portionRange(unit: string | undefined): { min: number; max: number; step: number } {
  return unit === 'pcs'
    ? { min: 1, max: 100, step: 1 }
    : { min: 10, max: 1500, step: 5 }
}

export const GRAMS_UNIT: Unit = { key: 'g', label: 'Grams', toGrams: (q) => q }

export type SmartPortion = { key: string; label: string; grams: number }
export type SmartEntry   = { pattern: RegExp; portions: SmartPortion[]; defaultKey: string }

/**
 * Order matters — `find` takes the first match, so specific dishes must come
 * before generic ingredient words (pani puri before puri, pav bhaji before
 * pav, peanut butter before ghee/butter).
 */
export const SMART_PORTIONS: SmartEntry[] = [
  // ── EGGS ──────────────────────────────────────────────────────────────────
  {
    pattern: /\begg\b|\banda\b/i,
    portions: [
      { key: 'small',  label: 'Small egg (38g)',       grams: 38 },
      { key: 'medium', label: 'Medium egg (44g)',      grams: 44 },
      { key: 'large',  label: 'Large egg (50g)',       grams: 50 },
      { key: 'xl',     label: 'Extra large egg (56g)', grams: 56 },
    ],
    defaultKey: 'large',
  },
  // ── BREADS ────────────────────────────────────────────────────────────────
  {
    pattern: /roti|chapati|chapathi/i,
    portions: [
      { key: 'small',  label: 'Small roti (25g)',  grams: 25 },
      { key: 'medium', label: 'Medium roti (35g)', grams: 35 },
      { key: 'large',  label: 'Large roti (45g)',  grams: 45 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /paratha/i,
    portions: [
      { key: 'small',  label: 'Small paratha (60g)',  grams: 60 },
      { key: 'medium', label: 'Medium paratha (80g)', grams: 80 },
      { key: 'large',  label: 'Large paratha (100g)', grams: 100 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /naan/i,
    portions: [
      { key: 'small',  label: 'Small naan (70g)',  grams: 70 },
      { key: 'medium', label: 'Medium naan (90g)', grams: 90 },
      { key: 'large',  label: 'Large naan (120g)', grams: 120 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /bhatura|bhature/i,
    portions: [
      { key: '1', label: '1 bhatura (80g)',   grams: 80 },
      { key: '2', label: '2 bhature (160g)',  grams: 160 },
    ],
    defaultKey: '1',
  },
  // Chaat plates BEFORE the generic puri pattern — "Pani Puri" / "Bhel Puri"
  // used to match /puri/ and log a single 25g puri for a whole plate.
  {
    pattern: /pani ?puri|gol ?gappa|golgappe|puchka/i,
    portions: [
      { key: '6',  label: '6 pieces with pani (90g)',   grams: 90 },
      { key: '8',  label: '8 pieces with pani (120g)',  grams: 120 },
      { key: '12', label: '12 pieces with pani (180g)', grams: 180 },
    ],
    defaultKey: '6',
  },
  {
    pattern: /bhel|jhal ?muri/i,
    portions: [
      { key: 'cup',   label: '1 cup (100g)',    grams: 100 },
      { key: 'plate', label: '1 plate (150g)',  grams: 150 },
    ],
    defaultKey: 'plate',
  },
  {
    pattern: /puri|poori/i,
    portions: [
      { key: '1', label: '1 puri (25g)',   grams: 25 },
      { key: '3', label: '3 puris (75g)',  grams: 75 },
      { key: '5', label: '5 puris (125g)', grams: 125 },
    ],
    defaultKey: '1',
  },
  {
    pattern: /thepla|makki|missi/i,
    portions: [
      { key: 'small',  label: 'Small (30g)',  grams: 30 },
      { key: 'medium', label: 'Medium (40g)', grams: 40 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /sandwich/i,
    portions: [
      { key: '1',     label: '1 sandwich (120g)',        grams: 120 },
      { key: 'large', label: 'Large / grilled (180g)',   grams: 180 },
    ],
    defaultKey: '1',
  },
  {
    pattern: /bread|toast/i,
    portions: [
      { key: '1', label: '1 slice (25g)',  grams: 25 },
      { key: '2', label: '2 slices (50g)', grams: 50 },
    ],
    defaultKey: '1',
  },
  // ── SOUTH INDIAN ──────────────────────────────────────────────────────────
  {
    pattern: /idli/i,
    portions: [
      { key: '1', label: '1 idli (40g)',   grams: 40 },
      { key: '2', label: '2 idlis (80g)',  grams: 80 },
      { key: '3', label: '3 idlis (120g)', grams: 120 },
      { key: '4', label: '4 idlis (160g)', grams: 160 },
    ],
    defaultKey: '2',
  },
  {
    pattern: /dosa/i,
    portions: [
      { key: 'small',  label: 'Small dosa (60g)',   grams: 60 },
      { key: 'medium', label: 'Medium dosa (80g)',  grams: 80 },
      { key: 'large',  label: 'Large dosa (120g)',  grams: 120 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /vada|wada/i,
    portions: [
      { key: '1', label: '1 vada (30g)',  grams: 30 },
      { key: '2', label: '2 vadas (60g)', grams: 60 },
    ],
    defaultKey: '1',
  },
  {
    pattern: /uttapam/i,
    portions: [
      { key: 'small',  label: 'Small uttapam (70g)',  grams: 70 },
      { key: 'medium', label: 'Medium uttapam (90g)', grams: 90 },
    ],
    defaultKey: 'medium',
  },
  // ── RICE ──────────────────────────────────────────────────────────────────
  {
    pattern: /biryani/i,
    portions: [
      { key: 'half',  label: 'Half plate (200g)',   grams: 200 },
      { key: 'plate', label: 'Full plate (350g)',   grams: 350 },
      { key: 'katori',label: '1 katori (150g)',     grams: 150 },
    ],
    defaultKey: 'plate',
  },
  {
    pattern: /pulao|pilaf/i,
    portions: [
      { key: 'katori', label: '1 katori (150g)', grams: 150 },
      { key: 'plate',  label: '1 plate (250g)',  grams: 250 },
    ],
    defaultKey: 'katori',
  },
  {
    pattern: /rice|chawal/i,
    portions: [
      { key: 'katori',  label: '1 katori cooked (150g)', grams: 150 },
      { key: '2katori', label: '2 katori (300g)',         grams: 300 },
      { key: 'plate',   label: '1 plate (250g)',          grams: 250 },
    ],
    defaultKey: 'katori',
  },
  // ── STREET FOOD ───────────────────────────────────────────────────────────
  // Pav bhaji must precede the generic /bhaji/ sabzi pattern below.
  {
    pattern: /pav bhaji/i,
    portions: [
      { key: 'plate',  label: '1 plate — bhaji + 2 pav (280g)', grams: 280 },
      { key: 'half',   label: 'Half plate (150g)',               grams: 150 },
    ],
    defaultKey: 'plate',
  },
  {
    pattern: /\bpav\b/i,
    portions: [
      { key: '1', label: '1 pav (40g)',  grams: 40 },
      { key: '2', label: '2 pav (80g)',  grams: 80 },
    ],
    defaultKey: '1',
  },
  {
    pattern: /momo/i,
    portions: [
      { key: '6',  label: '6 momos (120g)', grams: 120 },
      { key: '10', label: '10 momos (200g)',grams: 200 },
    ],
    defaultKey: '6',
  },
  // ── PACKAGED SNACKS ───────────────────────────────────────────────────────
  // Sits above DAL / CURRY on purpose. This table is scanned with `.find`, so
  // the first matching pattern wins, and a name can carry both a dish word and
  // a snack word: "Moong Dal Namkeen", "Balaji Wafers Chana Dal". Those are
  // packets, not katoris. Below the dal rule a 476 kcal/100 g namkeen
  // pre-selected a 200 g katori and offered ~952 kcal on tap-through, where
  // the pack is 30 g. Renaming the rows (migration 037) did not reach this —
  // it fires *after* the user has already picked the right food. A name
  // matching only one of the two patterns is unaffected, so cooked dal keeps
  // its katori.
  {
    pattern: /chips|wafers|namkeen|bhujia|mixture|\bsev\b/i,
    portions: [
      { key: 'handful', label: '1 handful (20g)',     grams: 20 },
      { key: 'pack',    label: 'Small pack (30g)',    grams: 30 },
      { key: 'katori',  label: '1 katori (40g)',      grams: 40 },
    ],
    defaultKey: 'pack',
  },
  // ── DAL / CURRY ───────────────────────────────────────────────────────────
  {
    pattern: /dal|daal|lentil|sambh?ar|rasam/i,
    portions: [
      { key: 'small',  label: 'Small katori (120ml)', grams: 120 },
      { key: 'medium', label: 'Katori (200ml)',        grams: 200 },
      { key: 'bowl',   label: '1 bowl (250ml)',        grams: 250 },
      { key: 'large',  label: 'Large katori (300ml)', grams: 300 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /paneer/i,
    portions: [
      { key: 'small',  label: 'Small katori (100g)',  grams: 100 },
      { key: 'medium', label: 'Katori (150g)',         grams: 150 },
      { key: 'large',  label: 'Large katori (200g)',  grams: 200 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /sabzi|subzi|bhaji|curry|masala|aloo|gobi|palak|bhindi|baingan|lauki|karela|methi|rajma|chole|chana/i,
    portions: [
      { key: 'small',  label: 'Small katori (100g)',  grams: 100 },
      { key: 'medium', label: 'Katori (150g)',         grams: 150 },
      { key: 'large',  label: 'Large katori (200g)',  grams: 200 },
    ],
    defaultKey: 'medium',
  },
  // ── BREAKFAST DISHES ──────────────────────────────────────────────────────
  {
    pattern: /poha/i,
    portions: [
      { key: 'small',  label: 'Small plate (150g)',  grams: 150 },
      { key: 'medium', label: 'Medium plate (200g)', grams: 200 },
      { key: 'large',  label: 'Large plate (300g)',  grams: 300 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /upma/i,
    portions: [
      { key: 'small',  label: 'Small plate (150g)',  grams: 150 },
      { key: 'medium', label: 'Medium plate (200g)', grams: 200 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /khichdi|khichri/i,
    portions: [
      { key: 'katori', label: '1 katori (200g)', grams: 200 },
      { key: 'plate',  label: '1 plate (300g)',  grams: 300 },
    ],
    defaultKey: 'katori',
  },
  {
    pattern: /\boats\b|oatmeal|porridge|muesli|granola/i,
    portions: [
      { key: 'small',  label: 'Small bowl cooked (30g dry)',  grams: 30 },
      { key: 'medium', label: '1 bowl cooked (40g dry)',      grams: 40 },
      { key: 'large',  label: 'Large bowl cooked (60g dry)',  grams: 60 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /dalia|daliya|broken wheat/i,
    portions: [
      { key: 'katori', label: '1 katori cooked (40g dry)', grams: 40 },
      { key: 'bowl',   label: '1 bowl cooked (60g dry)',   grams: 60 },
    ],
    defaultKey: 'katori',
  },
  {
    pattern: /cornflakes|corn flakes|chocos/i,
    portions: [
      { key: 'bowl',  label: '1 bowl (30g)',       grams: 30 },
      { key: 'large', label: 'Large bowl (45g)',   grams: 45 },
    ],
    defaultKey: 'bowl',
  },
  {
    pattern: /maggi|noodle|ramen|chowmein|chow mein/i,
    portions: [
      { key: 'half',  label: 'Half pack (35g dry)', grams: 35 },
      { key: 'pack',  label: '1 pack (70g dry)',    grams: 70 },
      { key: 'plate', label: '1 plate cooked (200g)', grams: 200 },
    ],
    defaultKey: 'pack',
  },
  // ── SNACKS ────────────────────────────────────────────────────────────────
  {
    pattern: /samosa/i,
    portions: [
      { key: 'small',  label: 'Small samosa (40g)',  grams: 40 },
      { key: 'medium', label: 'Medium samosa (60g)', grams: 60 },
      { key: 'large',  label: 'Large samosa (80g)',  grams: 80 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /kachori/i,
    portions: [
      { key: 'small',  label: 'Small kachori (40g)',  grams: 40 },
      { key: 'medium', label: 'Medium kachori (60g)', grams: 60 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /pakora|pakoda/i,
    portions: [
      { key: '2',  label: '2 pieces (40g)',  grams: 40 },
      { key: '4',  label: '4 pieces (80g)',  grams: 80 },
      { key: '6',  label: '6 pieces (120g)', grams: 120 },
    ],
    defaultKey: '4',
  },
  {
    pattern: /biscuit|cookie/i,
    portions: [
      { key: '1', label: '1 biscuit (10g)', grams: 10 },
      { key: '2', label: '2 biscuits (20g)',grams: 20 },
      { key: '4', label: '4 biscuits (40g)',grams: 40 },
    ],
    defaultKey: '2',
  },
  {
    pattern: /pizza/i,
    portions: [
      { key: '1',     label: '1 slice (90g)',    grams: 90 },
      { key: '2',     label: '2 slices (180g)',  grams: 180 },
      { key: '4',     label: '4 slices (360g)',  grams: 360 },
    ],
    defaultKey: '1',
  },
  {
    pattern: /burger/i,
    portions: [
      { key: '1',     label: '1 burger (150g)',      grams: 150 },
      { key: 'large', label: 'Large burger (250g)',  grams: 250 },
    ],
    defaultKey: '1',
  },
  // ── SOUP / SALAD / SPROUTS ────────────────────────────────────────────────
  {
    pattern: /soup|shorba/i,
    portions: [
      { key: 'cup',  label: '1 cup (150ml)',   grams: 150 },
      { key: 'bowl', label: '1 bowl (250ml)',  grams: 250 },
    ],
    defaultKey: 'bowl',
  },
  {
    pattern: /salad|kachumber/i,
    portions: [
      { key: 'katori', label: '1 katori (80g)',  grams: 80 },
      { key: 'bowl',   label: '1 bowl (150g)',   grams: 150 },
      { key: 'plate',  label: '1 plate (200g)',  grams: 200 },
    ],
    defaultKey: 'bowl',
  },
  {
    pattern: /sprout/i,
    portions: [
      { key: 'katori', label: '1 katori (100g)', grams: 100 },
      { key: 'bowl',   label: '1 bowl (150g)',   grams: 150 },
    ],
    defaultKey: 'katori',
  },
  // ── MEAT / CHICKEN ────────────────────────────────────────────────────────
  {
    pattern: /chicken breast/i,
    portions: [
      { key: 'small',  label: 'Small piece (80g)',   grams: 80 },
      { key: 'medium', label: 'Medium piece (120g)', grams: 120 },
      { key: 'large',  label: 'Large piece (170g)',  grams: 170 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /chicken|murgh|tandoori/i,
    portions: [
      { key: 'katori', label: 'Katori / curry (150g)', grams: 150 },
      { key: 'piece',  label: '1 piece / drumstick (80g)', grams: 80 },
      { key: 'half',   label: 'Half portion (200g)',   grams: 200 },
    ],
    defaultKey: 'katori',
  },
  {
    pattern: /mutton|gosht|lamb/i,
    portions: [
      { key: 'small',  label: 'Small katori (100g)',  grams: 100 },
      { key: 'medium', label: 'Katori (150g)',         grams: 150 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /fish|machli|rohu|pomfret|salmon/i,
    portions: [
      { key: 'small',  label: 'Small piece (80g)',   grams: 80 },
      { key: 'medium', label: 'Medium piece (120g)', grams: 120 },
      { key: 'large',  label: 'Large piece (160g)',  grams: 160 },
    ],
    defaultKey: 'medium',
  },
  // ── DAIRY ─────────────────────────────────────────────────────────────────
  {
    pattern: /milkshake|smoothie|\bshake\b/i,
    portions: [
      { key: 'glass', label: '1 glass (250ml)', grams: 250 },
      { key: 'large', label: 'Large (350ml)',   grams: 350 },
    ],
    defaultKey: 'glass',
  },
  {
    pattern: /milk|doodh/i,
    portions: [
      { key: 'half',  label: 'Half glass (100ml)', grams: 100 },
      { key: 'glass', label: '1 glass (200ml)',    grams: 200 },
      { key: 'cup',   label: '1 cup (240ml)',      grams: 240 },
    ],
    defaultKey: 'glass',
  },
  {
    pattern: /curd|dahi|yogurt/i,
    portions: [
      { key: 'small',  label: 'Small katori (80g)',  grams: 80 },
      { key: 'medium', label: 'Katori (150g)',        grams: 150 },
      { key: 'large',  label: 'Large katori (200g)', grams: 200 },
      { key: 'bowl',   label: '1 bowl (250g)',       grams: 250 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /lassi|chaas|buttermilk/i,
    portions: [
      { key: 'glass',  label: '1 glass (200ml)', grams: 200 },
      { key: 'large',  label: 'Large (300ml)',   grams: 300 },
    ],
    defaultKey: 'glass',
  },
  // Peanut butter BEFORE ghee/butter — it used to fall into that bucket.
  {
    pattern: /peanut butter|almond butter/i,
    portions: [
      { key: 'tsp',   label: '1 tsp (8g)',    grams: 8 },
      { key: 'tbsp',  label: '1 tbsp (16g)',  grams: 16 },
      { key: '2tbsp', label: '2 tbsp (32g)',  grams: 32 },
    ],
    defaultKey: 'tbsp',
  },
  {
    pattern: /ghee|butter/i,
    portions: [
      { key: 'tsp',   label: '1 tsp (5g)',   grams: 5 },
      { key: 'tbsp',  label: '1 tbsp (15g)', grams: 15 },
    ],
    defaultKey: 'tsp',
  },
  // ── DRINKS ────────────────────────────────────────────────────────────────
  {
    pattern: /chai|tea/i,
    portions: [
      { key: 'cutting', label: 'Cutting chai (100ml)', grams: 100 },
      { key: 'cup',     label: '1 cup (150ml)',         grams: 150 },
      { key: 'mug',     label: 'Mug (250ml)',           grams: 250 },
    ],
    defaultKey: 'cup',
  },
  {
    pattern: /coffee/i,
    portions: [
      { key: 'cup',  label: '1 cup (150ml)',  grams: 150 },
      { key: 'mug',  label: 'Mug (250ml)',    grams: 250 },
    ],
    defaultKey: 'cup',
  },
  {
    pattern: /coconut water|nariyal pani/i,
    portions: [
      { key: 'glass',   label: '1 glass (200ml)',       grams: 200 },
      { key: 'coconut', label: '1 coconut (~300ml)',    grams: 300 },
    ],
    defaultKey: 'glass',
  },
  {
    pattern: /cola|pepsi|thums|sprite|fanta|soft drink|\bsoda\b/i,
    portions: [
      { key: 'glass',  label: '1 glass (250ml)',   grams: 250 },
      { key: 'can',    label: '1 can (330ml)',     grams: 330 },
      { key: 'bottle', label: '1 bottle (600ml)',  grams: 600 },
    ],
    defaultKey: 'glass',
  },
  {
    pattern: /juice|nimbu|panna|sharbat/i,
    portions: [
      { key: 'glass',  label: '1 glass (200ml)', grams: 200 },
      { key: 'large',  label: 'Large (300ml)',   grams: 300 },
    ],
    defaultKey: 'glass',
  },
  // ── SWEETS ────────────────────────────────────────────────────────────────
  {
    pattern: /ladoo|laddoo/i,
    portions: [
      { key: 'small',  label: 'Small ladoo (25g)',  grams: 25 },
      { key: 'medium', label: 'Medium ladoo (40g)', grams: 40 },
      { key: 'large',  label: 'Large ladoo (55g)',  grams: 55 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /gulab jamun/i,
    portions: [
      { key: '1', label: '1 piece (40g)', grams: 40 },
      { key: '2', label: '2 pieces (80g)',grams: 80 },
    ],
    defaultKey: '1',
  },
  {
    pattern: /jalebi/i,
    portions: [
      { key: 'small',  label: 'Small serving (40g)',  grams: 40 },
      { key: 'medium', label: 'Medium serving (80g)', grams: 80 },
    ],
    defaultKey: 'small',
  },
  {
    pattern: /halwa/i,
    portions: [
      { key: 'small',  label: 'Small katori (80g)',  grams: 80 },
      { key: 'medium', label: 'Katori (150g)',        grams: 150 },
    ],
    defaultKey: 'small',
  },
  {
    pattern: /kheer|payasam/i,
    portions: [
      { key: 'small',  label: 'Small katori (100g)',  grams: 100 },
      { key: 'medium', label: 'Katori (150g)',         grams: 150 },
    ],
    defaultKey: 'small',
  },
  {
    pattern: /kulfi/i,
    portions: [
      { key: '1', label: '1 kulfi (70g)',   grams: 70 },
      { key: '2', label: '2 kulfis (140g)', grams: 140 },
    ],
    defaultKey: '1',
  },
  {
    pattern: /ice ?cream/i,
    portions: [
      { key: 'scoop',  label: '1 scoop (60g)',   grams: 60 },
      { key: '2scoop', label: '2 scoops (120g)', grams: 120 },
      { key: 'cup',    label: '1 cup (100g)',    grams: 100 },
    ],
    defaultKey: 'scoop',
  },
  {
    pattern: /chocolate|dairy milk|kitkat|kit kat/i,
    portions: [
      { key: 'squares', label: '2 squares (10g)',  grams: 10 },
      { key: 'half',    label: 'Half bar (25g)',   grams: 25 },
      { key: 'bar',     label: '1 bar (50g)',      grams: 50 },
    ],
    defaultKey: 'half',
  },
  {
    pattern: /sugar|honey|jaggery|\bgur\b|shahad/i,
    portions: [
      { key: 'tsp',  label: '1 tsp (5g)',   grams: 5 },
      { key: 'tbsp', label: '1 tbsp (15g)', grams: 15 },
    ],
    defaultKey: 'tsp',
  },
  // ── FRUITS ────────────────────────────────────────────────────────────────
  {
    pattern: /banana|kela/i,
    portions: [
      { key: 'small',  label: 'Small banana (80g)',   grams: 80 },
      { key: 'medium', label: 'Medium banana (120g)', grams: 120 },
      { key: 'large',  label: 'Large banana (150g)',  grams: 150 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /mango|aam/i,
    portions: [
      { key: 'small',  label: 'Small mango (150g)',  grams: 150 },
      { key: 'medium', label: 'Medium mango (200g)', grams: 200 },
      { key: 'large',  label: 'Large mango (300g)',  grams: 300 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /apple/i,
    portions: [
      { key: 'small',  label: 'Small apple (120g)',  grams: 120 },
      { key: 'medium', label: 'Medium apple (150g)', grams: 150 },
      { key: 'large',  label: 'Large apple (200g)',  grams: 200 },
    ],
    defaultKey: 'medium',
  },
  {
    pattern: /orange|mosambi/i,
    portions: [
      { key: 'small',  label: 'Small (100g)',  grams: 100 },
      { key: 'medium', label: 'Medium (130g)', grams: 130 },
      { key: 'large',  label: 'Large (180g)',  grams: 180 },
    ],
    defaultKey: 'medium',
  },
  // ── NUTS ──────────────────────────────────────────────────────────────────
  {
    pattern: /almond|badam/i,
    portions: [
      { key: '6',      label: '6 almonds (8g)',      grams: 8 },
      { key: '12',     label: '12 almonds (15g)',     grams: 15 },
      { key: 'small',  label: 'Small handful (20g)', grams: 20 },
    ],
    defaultKey: '12',
  },
  {
    pattern: /cashew|kaju/i,
    portions: [
      { key: '5',     label: '5 cashews (8g)',       grams: 8 },
      { key: '10',    label: '10 cashews (16g)',      grams: 16 },
      { key: 'small', label: 'Small handful (25g)',  grams: 25 },
    ],
    defaultKey: '10',
  },
  {
    pattern: /peanut|moongfali/i,
    portions: [
      { key: 'small',  label: 'Small handful (20g)', grams: 20 },
      { key: 'medium', label: 'Medium handful (30g)',grams: 30 },
    ],
    defaultKey: 'small',
  },
]

export function buildUnits(food: Food): Unit[] {
  const units: Unit[] = []

  // Always offer grams first (raw input)
  units.push(GRAMS_UNIT)

  // 1. Smart lookup — works for ALL sources (USDA, OFF, IFCT, custom)
  //    This fixes the root cause: serving_size_g = 100 in nutrition DBs ≠ 1 real serving
  const smartMatch = SMART_PORTIONS.find((e) => e.pattern.test(food.name))
  if (smartMatch) {
    for (const p of smartMatch.portions) {
      units.push({ key: p.key, label: p.label, toGrams: (q) => q * p.grams })
    }
  }
  // 2. Fall back to common_portions from DB (IFCT migration 008)
  else if (food.common_portions && food.common_portions.length > 0) {
    for (const p of food.common_portions) {
      if (p.unit === 'gram') continue
      units.push({
        key: `portion_${p.unit}_${p.grams}`,
        label: p.label,
        toGrams: (q) => q * p.grams,
      })
    }
  }
  // 3. Last resort: use serving_size_g only if it's a realistic single serving (not the default 100g)
  else if (food.serving_size_g > 0 && food.serving_size_g !== 100) {
    units.push({
      key: 'serving',
      label: `1 serving (${food.serving_size_g}g)`,
      toGrams: (q) => q * food.serving_size_g,
    })
  }

  // Ounces intentionally omitted — this is an India-first app; grams +
  // household measures (katori/plate/glass) are what users actually think in.
  return units
}

export function pickDefaultUnit(units: Unit[], food: Food): Unit {
  // Smart lookup: default to the specific size variant defined in the entry
  const smartMatch = SMART_PORTIONS.find((e) => e.pattern.test(food.name))
  if (smartMatch) {
    const def = units.find((u) => u.key === smartMatch.defaultKey)
    if (def) return def
  }
  // Otherwise first non-gram, non-oz option
  const first = units.find((u) => u.key !== 'g' && u.key !== 'oz')
  if (first) return first
  return units[0]
}

/**
 * What a nutrition database stores as a serving size when it doesn't actually
 * know one. Logging that as the amount is wrong, but logging 0 g is worse.
 */
export const FALLBACK_SERVING_G = 100

/**
 * The single answer to "how much of this food is one serving?" — used both by
 * the quick-add "+" on a search row and by the amount AddFoodModal opens on,
 * so two adjacent buttons can never log different amounts of the same food.
 *
 * One of the default household measure where the food has one. Where it has
 * none, `buildUnits` returns grams alone, and the quantity is then the food's
 * own serving size rather than the literal 1 — which is what used to open the
 * modal on "1 gram" for any Open Food Facts row with an unparseable serving.
 *
 * Pass `units` when the caller already built them, so the returned unit is the
 * same object the picker is rendering.
 */
export function defaultPortionFor(
  food: Food,
  units: Unit[] = buildUnits(food)
): { unit: Unit; quantity: number; grams: number } {
  const unit = pickDefaultUnit(units, food)
  const quantity =
    unit.key === 'g' ? (food.serving_size_g > 0 ? food.serving_size_g : FALLBACK_SERVING_G) : 1
  return { unit, quantity, grams: unit.toGrams(quantity) }
}

/**
 * Given a stored gram total (e.g. an existing log entry being edited), find
 * the household unit + quantity that expresses it most naturally:
 * "150g cooked rice" → 1 katori, "80g idli" → 2 idlis.
 *
 * Only quarter-step quantities (0.25 … 12) that reproduce the stored grams
 * within ~2% are considered; whole counts beat halves beat quarters, with a
 * mild preference for quantities near 1. Anything irregular (e.g. 180g rice
 * against a 150g katori) falls back to plain grams so we never misrepresent
 * what was logged.
 */
export function inferPortionSelection(units: Unit[], grams: number): { unit: Unit; quantity: number } {
  const gramUnit = units.find((u) => u.key === 'g') ?? GRAMS_UNIT
  let best: { unit: Unit; quantity: number; score: number } | null = null

  for (const u of units) {
    if (u.key === 'g' || u.key === 'oz') continue
    const per = u.toGrams(1)
    if (per <= 0) continue
    const q = grams / per
    if (q < 0.24 || q > 12) continue
    const snapped = Math.round(q * 4) / 4 // nearest quarter portion
    if (snapped <= 0) continue
    if (Math.abs(snapped * per - grams) > Math.max(2, grams * 0.02)) continue
    const granularity = Number.isInteger(snapped) ? 2 : (snapped * 2) % 1 === 0 ? 1 : 0
    const score = granularity - Math.abs(snapped - 1) * 0.1
    if (!best || score > best.score) best = { unit: u, quantity: snapped, score }
  }

  if (best) return { unit: best.unit, quantity: best.quantity }
  return { unit: gramUnit, quantity: grams }
}

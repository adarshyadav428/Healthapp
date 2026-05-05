/**
 * Generate a large India-first foods dataset using estimated nutrition values.
 * Output: data/indian-foods.json
 */
import * as fs from 'fs'
import * as path from 'path'

type FoodSeed = {
  source: string
  source_id: string
  name: string
  brand: string | null
  serving_size_g: number
  serving_description: string
  kcal_per_100g: number
  protein_g_per_100g: number
  carbs_g_per_100g: number
  fat_g_per_100g: number
  fiber_g_per_100g: number | null
}

type Serving = { size: number; desc: string }

type CategorySpec = {
  base: { protein: number; carbs: number; fat: number; fiber: number }
  serving: Serving
  variance: number
}

type CategoryKey =
  | 'grain_cooked'
  | 'grain_raw'
  | 'bread'
  | 'rice_dish'
  | 'south_indian'
  | 'dal'
  | 'veg'
  | 'paneer'
  | 'chicken'
  | 'egg'
  | 'mutton'
  | 'fish'
  | 'street'
  | 'snack'
  | 'sweet'
  | 'beverage'
  | 'fruit'
  | 'nut'
  | 'packaged_snack'
  | 'packaged_biscuit'
  | 'packaged_noodles'
  | 'packaged_dairy'
  | 'packaged_drink'

type Item = {
  name: string
  category: CategoryKey
  brand?: string | null
  serving?: Serving
}

type Macros = { protein: number; carbs: number; fat: number; fiber: number }

const serving = (label: string, size: number, unit = 'g'): Serving => ({
  size,
  desc: `${label} (${size}${unit})`,
})

const categories: Record<CategoryKey, CategorySpec> = {
  grain_cooked: { base: { protein: 2.5, carbs: 28, fat: 0.4, fiber: 0.6 }, serving: serving('1 katori', 180), variance: 0.12 },
  grain_raw: { base: { protein: 10, carbs: 72, fat: 2, fiber: 7 }, serving: serving('2 tbsp', 30), variance: 0.1 },
  bread: { base: { protein: 7.5, carbs: 55, fat: 5, fiber: 2 }, serving: serving('1 piece', 40), variance: 0.15 },
  rice_dish: { base: { protein: 4.5, carbs: 23, fat: 4, fiber: 1.2 }, serving: serving('1 plate', 250), variance: 0.15 },
  south_indian: { base: { protein: 3.5, carbs: 20, fat: 2.5, fiber: 1.2 }, serving: serving('1 serving', 120), variance: 0.15 },
  dal: { base: { protein: 7.5, carbs: 16, fat: 1.5, fiber: 3.5 }, serving: serving('1 katori', 150), variance: 0.15 },
  veg: { base: { protein: 2, carbs: 8, fat: 3, fiber: 2.5 }, serving: serving('1 katori', 150), variance: 0.2 },
  paneer: { base: { protein: 9, carbs: 6, fat: 10, fiber: 1 }, serving: serving('1 katori', 200), variance: 0.18 },
  chicken: { base: { protein: 15, carbs: 4, fat: 7, fiber: 0.5 }, serving: serving('1 katori', 200), variance: 0.18 },
  egg: { base: { protein: 10, carbs: 2, fat: 8, fiber: 0 }, serving: serving('2 eggs', 100), variance: 0.18 },
  mutton: { base: { protein: 14, carbs: 2, fat: 12, fiber: 0.4 }, serving: serving('1 katori', 200), variance: 0.18 },
  fish: { base: { protein: 16, carbs: 2, fat: 6, fiber: 0.2 }, serving: serving('1 katori', 200), variance: 0.18 },
  street: { base: { protein: 6, carbs: 30, fat: 12, fiber: 2 }, serving: serving('1 plate', 150), variance: 0.2 },
  snack: { base: { protein: 5, carbs: 25, fat: 10, fiber: 1.8 }, serving: serving('1 plate', 120), variance: 0.2 },
  sweet: { base: { protein: 4, carbs: 50, fat: 15, fiber: 1 }, serving: serving('1 piece', 60), variance: 0.2 },
  beverage: { base: { protein: 1.5, carbs: 8, fat: 2.5, fiber: 0 }, serving: serving('1 glass', 250, 'ml'), variance: 0.2 },
  fruit: { base: { protein: 0.8, carbs: 12, fat: 0.2, fiber: 2 }, serving: serving('1 medium', 100), variance: 0.25 },
  nut: { base: { protein: 18, carbs: 15, fat: 50, fiber: 7 }, serving: serving('1 handful', 30), variance: 0.2 },
  packaged_snack: { base: { protein: 6, carbs: 45, fat: 20, fiber: 2 }, serving: serving('1 packet', 50), variance: 0.2 },
  packaged_biscuit: { base: { protein: 6, carbs: 70, fat: 18, fiber: 2 }, serving: serving('3 biscuits', 30), variance: 0.2 },
  packaged_noodles: { base: { protein: 9, carbs: 60, fat: 15, fiber: 3 }, serving: serving('1 packet', 70), variance: 0.2 },
  packaged_dairy: { base: { protein: 4, carbs: 10, fat: 6, fiber: 0 }, serving: serving('1 cup', 200), variance: 0.15 },
  packaged_drink: { base: { protein: 0.5, carbs: 12, fat: 0.5, fiber: 0 }, serving: serving('1 glass', 200, 'ml'), variance: 0.2 },
}

const items: Item[] = []
const add = (item: Item) => items.push(item)
const addMany = (names: string[], category: CategoryKey) => names.forEach((name) => add({ name, category }))
const addItems = (list: Item[]) => list.forEach(add)

const hashString = (input: string): number => {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const hashUnit = (input: string): number => (hashString(input) % 1000) / 1000

const round1 = (value: number): number => Math.round(value * 10) / 10

const clamp = (value: number, min = 0, max = 999): number => Math.max(min, Math.min(max, value))

const vary = (base: number, key: string, variance: number): number => {
  const v = (hashUnit(key) - 0.5) * 2
  return base * (1 + v * variance)
}

const applyKeywordAdjustments = (name: string, macros: Macros): Macros => {
  const lower = name.toLowerCase()
  let { protein, carbs, fat, fiber } = macros

  const has = (re: RegExp) => re.test(lower)

  if (has(/fried|pakora|bhatura|puri|kachori|chips|namkeen|sev|bhujia|vada|pav bhaji/)) {
    fat *= 1.25
    carbs *= 1.05
  }

  if (has(/butter|ghee|malai|cream|cheese|makhani|korma/)) {
    fat *= 1.2
  }

  if (has(/tandoori|grilled|roasted|steamed|boiled/)) {
    fat *= 0.85
  }

  if (has(/sweet|halwa|kheer|ladoo|barfi|jamun|jalebi|rasgulla|rasmalai|kaju|kalakand|mysore pak|kulfi|falooda|peda|rabri|phirni|basundi|shrikhand|imarti|soan papdi|chikki/)) {
    carbs *= 1.18
    fat *= 1.12
  }

  if (has(/salad|sprout|soup|clear/)) {
    carbs *= 0.9
    fat *= 0.8
  }

  if (has(/juice|drink|lassi|chaas|buttermilk|shake|milk|tea|coffee|pani|water/)) {
    fat *= 0.85
  }

  return { protein, carbs, fat, fiber }
}

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const usedIds = new Map<string, number>()

const makeSourceId = (name: string, brand?: string | null): string => {
  const base = brand ? `${slugify(brand)}-${slugify(name)}` : slugify(name)
  const root = `est-${base}`
  const count = usedIds.get(root) ?? 0
  usedIds.set(root, count + 1)
  return count === 0 ? root : `${root}-${count + 1}`
}

const makeFood = (item: Item): FoodSeed => {
  const spec = categories[item.category]
  const servingInfo = item.serving ?? spec.serving
  const name = item.name.trim()
  const brand = item.brand ?? null

  let protein = vary(spec.base.protein, `${name}-p`, spec.variance)
  let carbs = vary(spec.base.carbs, `${name}-c`, spec.variance)
  let fat = vary(spec.base.fat, `${name}-f`, spec.variance)
  let fiber = vary(spec.base.fiber, `${name}-fi`, spec.variance)

  ;({ protein, carbs, fat, fiber } = applyKeywordAdjustments(name, { protein, carbs, fat, fiber }))

  protein = clamp(round1(protein))
  carbs = clamp(round1(carbs))
  fat = clamp(round1(fat))
  fiber = clamp(round1(fiber))

  const kcal = clamp(round1(protein * 4 + carbs * 4 + fat * 9))

  return {
    source: 'estimate',
    source_id: makeSourceId(name, brand),
    name,
    brand,
    serving_size_g: servingInfo.size,
    serving_description: servingInfo.desc,
    kcal_per_100g: kcal,
    protein_g_per_100g: protein,
    carbs_g_per_100g: carbs,
    fat_g_per_100g: fat,
    fiber_g_per_100g: fiber,
  }
}

// Grains and flours
addMany(
  [
    'Cooked Rice (Chawal)',
    'Cooked Basmati Rice',
    'Brown Rice (Cooked)',
    'Red Rice (Cooked)',
    'Steamed Rice',
    'Hand Pounded Rice (Cooked)',
    'Bajra (Cooked)',
    'Jowar (Cooked)',
    'Ragi (Cooked)',
    'Foxtail Millet (Cooked)',
    'Barnyard Millet (Cooked)',
    'Little Millet (Cooked)',
    'Kodo Millet (Cooked)',
    'Samak Rice (Cooked)',
    'Broken Wheat (Dalia) Cooked',
    'Oats (Cooked)',
    'Quinoa (Cooked)',
    'Barley (Cooked)',
    'Poha (Cooked)',
    'Sabudana (Cooked)',
  ],
  'grain_cooked'
)

addItems([
  { name: 'Raw Rice (Chawal)', category: 'grain_raw', serving: serving('100g', 100) },
  { name: 'Basmati Rice (Raw)', category: 'grain_raw', serving: serving('100g', 100) },
  { name: 'Brown Rice (Raw)', category: 'grain_raw', serving: serving('100g', 100) },
  { name: 'Wheat Flour (Atta)', category: 'grain_raw' },
  { name: 'Bajra Flour', category: 'grain_raw' },
  { name: 'Jowar Flour', category: 'grain_raw' },
  { name: 'Ragi Flour', category: 'grain_raw' },
  { name: 'Besan (Gram Flour)', category: 'grain_raw' },
  { name: 'Sooji (Semolina)', category: 'grain_raw' },
  { name: 'Maida (Refined Flour)', category: 'grain_raw' },
  { name: 'Rice Flour', category: 'grain_raw' },
  { name: 'Poha (Flattened Rice)', category: 'grain_raw' },
  { name: 'Dalia (Broken Wheat)', category: 'grain_raw' },
  { name: 'Sabudana (Tapioca Pearls)', category: 'grain_raw' },
  { name: 'Makki Flour (Corn Flour)', category: 'grain_raw' },
  { name: 'Sattu (Roasted Gram Flour)', category: 'grain_raw' },
])

// Breads and rotis
addItems([
  { name: 'Roti / Chapati (Wheat)', category: 'bread', serving: serving('1 roti', 40) },
  { name: 'Tandoori Roti', category: 'bread', serving: serving('1 roti', 50) },
  { name: 'Missi Roti', category: 'bread', serving: serving('1 roti', 50) },
  { name: 'Bajra Roti', category: 'bread', serving: serving('1 roti', 50) },
  { name: 'Jowar Roti', category: 'bread', serving: serving('1 roti', 50) },
  { name: 'Ragi Roti', category: 'bread', serving: serving('1 roti', 50) },
  { name: 'Makki ki Roti', category: 'bread', serving: serving('1 roti', 50) },
  { name: 'Thepla', category: 'bread', serving: serving('1 thepla', 50) },
  { name: 'Khakra', category: 'bread', serving: serving('1 khakra', 30) },
  { name: 'Bhakri', category: 'bread', serving: serving('1 bhakri', 60) },
  { name: 'Naan', category: 'bread', serving: serving('1 naan', 90) },
  { name: 'Butter Naan', category: 'bread', serving: serving('1 naan', 100) },
  { name: 'Garlic Naan', category: 'bread', serving: serving('1 naan', 100) },
  { name: 'Kulcha', category: 'bread', serving: serving('1 kulcha', 90) },
  { name: 'Amritsari Kulcha', category: 'bread', serving: serving('1 kulcha', 100) },
  { name: 'Bhatura', category: 'bread', serving: serving('1 bhatura', 80) },
  { name: 'Puri', category: 'bread', serving: serving('1 puri', 30) },
  { name: 'Luchi', category: 'bread', serving: serving('1 luchi', 30) },
  { name: 'Paratha (Plain)', category: 'bread', serving: serving('1 paratha', 70) },
  { name: 'Aloo Paratha', category: 'bread', serving: serving('1 paratha', 100) },
  { name: 'Gobi Paratha', category: 'bread', serving: serving('1 paratha', 100) },
  { name: 'Methi Paratha', category: 'bread', serving: serving('1 paratha', 100) },
  { name: 'Paneer Paratha', category: 'bread', serving: serving('1 paratha', 110) },
  { name: 'Lachha Paratha', category: 'bread', serving: serving('1 paratha', 90) },
  { name: 'Roomali Roti', category: 'bread', serving: serving('1 roti', 40) },
  { name: 'Pav (Bread Roll)', category: 'bread', serving: serving('1 pav', 60) },
  { name: 'White Bread Slice', category: 'bread', serving: serving('1 slice', 25) },
  { name: 'Brown Bread Slice', category: 'bread', serving: serving('1 slice', 25) },
])

// Rice dishes
addMany(
  [
    'Veg Pulao',
    'Peas Pulao',
    'Paneer Pulao',
    'Mushroom Pulao',
    'Kashmiri Pulao',
    'Veg Biryani',
    'Chicken Biryani',
    'Mutton Biryani',
    'Hyderabadi Biryani',
    'Kolkata Biryani',
    'Lucknowi Biryani',
    'Prawn Biryani',
    'Fish Biryani',
    'Veg Fried Rice',
    'Egg Fried Rice',
    'Chicken Fried Rice',
    'Jeera Rice',
    'Ghee Rice',
    'Lemon Rice',
    'Tamarind Rice',
    'Curd Rice',
    'Coconut Rice',
    'Tomato Rice',
    'Sambar Rice',
    'Pepper Rice',
    'Khichdi (Moong Dal)',
    'Khichdi (Masala)',
    'Masala Khichdi',
    'Veg Tehri',
    'Zarda Rice (Sweet Rice)',
  ],
  'rice_dish'
)

// South Indian
addMany(
  [
    'Idli',
    'Rava Idli',
    'Plain Dosa',
    'Masala Dosa',
    'Rava Dosa',
    'Onion Dosa',
    'Uttapam (Plain)',
    'Uttapam (Onion)',
    'Medu Vada',
    'Sambhar',
    'Rasam',
    'Coconut Chutney',
    'Tomato Chutney',
    'Pesarattu',
    'Appam',
    'Puttu',
    'Ven Pongal',
    'Sweet Pongal',
    'Bisi Bele Bath',
    'Avial',
    'Kadala Curry',
    'Kootu',
    'Poriyal',
    'Kozhukattai',
    'Idiyappam',
  ],
  'south_indian'
)

// Dals and legumes
addMany(
  [
    'Toor Dal (Plain)',
    'Toor Dal Tadka',
    'Moong Dal (Yellow)',
    'Moong Dal (Green)',
    'Masoor Dal',
    'Chana Dal',
    'Urad Dal',
    'Dal Fry',
    'Dal Tadka',
    'Dal Makhani',
    'Rajma',
    'Chole / Chana Masala',
    'Lobia Curry',
    'Kala Chana Curry',
    'Gujarati Kadhi',
    'Punjabi Kadhi',
    'Rasam Dal',
    'Sprouted Moong Salad',
    'Sprouted Kala Chana',
    'Pachranga Dal',
    'Dal Palak',
    'Dal Dhokli',
    'Gatte ki Sabzi',
    'Chana Sundal',
    'Masoor Dal Tadka',
  ],
  'dal'
)

// Vegetable sabzi
const vegetables = [
  'Aloo',
  'Bhindi',
  'Baingan',
  'Gobi',
  'Matar',
  'Palak',
  'Lauki',
  'Tinda',
  'Torai',
  'Karela',
  'Methi',
  'Shimla Mirch',
  'Cabbage',
  'Carrot',
  'Beetroot',
  'Beans',
  'Kaddu',
  'Arbi',
  'Parwal',
  'Kundru',
  'Jackfruit (Kathal)',
  'Drumstick (Moringa)',
  'Cauliflower',
  'Broccoli',
  'Mushroom',
  'Corn',
  'Okra',
  'Pumpkin',
  'Zucchini',
  'Bottle Gourd',
]

const vegStyles = ['Sabzi', 'Masala', 'Bhaji', 'Stir Fry']

for (const veg of vegetables) {
  for (const style of vegStyles) {
    add({ name: `${veg} ${style}`, category: 'veg' })
  }
}

addMany(
  [
    'Aloo Gobi',
    'Aloo Matar',
    'Aloo Palak',
    'Aloo Baingan',
    'Aloo Shimla Mirch',
    'Bhindi Aloo',
    'Chana Aloo',
    'Methi Aloo',
    'Mix Veg Sabzi',
    'Veg Korma',
    'Kofta Curry (Veg)',
    'Aloo Jeera',
    'Palak Corn',
    'Corn Matar',
    'Mushroom Masala',
    'Kadai Veg',
    'Veg Jalfrezi',
    'Veg Kolhapuri',
    'Navratan Korma',
    'Veg Handi',
  ],
  'veg'
)

// Paneer
addMany(
  [
    'Paneer Butter Masala',
    'Shahi Paneer',
    'Kadai Paneer',
    'Palak Paneer',
    'Matar Paneer',
    'Paneer Tikka',
    'Paneer Bhurji',
    'Paneer Pasanda',
    'Paneer Lababdar',
    'Paneer Do Pyaza',
    'Paneer Kofta Curry',
    'Paneer Kali Mirch',
    'Paneer Malai',
    'Achari Paneer',
    'Chilli Paneer (Dry)',
    'Chilli Paneer (Gravy)',
    'Paneer 65',
    'Paneer Jalfrezi',
    'Paneer Saag',
    'Paneer Korma',
  ],
  'paneer'
)

// Chicken
addMany(
  [
    'Chicken Curry',
    'Butter Chicken',
    'Chicken Tikka Masala',
    'Chicken Korma',
    'Chicken Chettinad',
    'Chicken 65',
    'Tandoori Chicken',
    'Chicken Sukka',
    'Chicken Jalfrezi',
    'Chicken Do Pyaza',
    'Chicken Saag',
    'Chicken Rezala',
    'Chicken Stew',
    'Chicken Vindaloo',
    'Chicken Kolhapuri',
    'Chicken Afghani',
    'Chicken Pepper Fry',
    'Chicken Manchurian',
    'Chicken Lollipop',
    'Chicken Kebab',
    'Chicken Keema',
    'Chicken Sausage Curry',
    'Chicken Roast',
    'Chicken Bhuna',
    'Chicken Hyderabadi',
  ],
  'chicken'
)

// Egg
addMany(
  [
    'Boiled Egg',
    'Fried Egg',
    'Omelette (Plain)',
    'Omelette (Masala)',
    'Egg Bhurji',
    'Egg Curry',
    'Egg Masala',
    'Egg Roast',
    'Egg Korma',
    'Egg Tikka',
    'Egg Pulusu',
    'Egg Pakora',
    'Egg Bhaji',
    'Egg Pepper Fry',
    'Egg Salad',
  ],
  'egg'
)

// Mutton
addMany(
  [
    'Mutton Curry',
    'Mutton Rogan Josh',
    'Mutton Korma',
    'Mutton Keema',
    'Mutton Do Pyaza',
    'Mutton Saag',
    'Mutton Nihari',
    'Mutton Vindaloo',
    'Mutton Kolhapuri',
    'Mutton Kebab',
    'Mutton Stew',
    'Mutton Rara',
    'Mutton Masala',
    'Mutton Pepper Fry',
    'Mutton Bhuna',
  ],
  'mutton'
)

// Fish and seafood
addMany(
  [
    'Fish Curry',
    'Fish Fry',
    'Fish Tikka',
    'Fish Masala',
    'Fish Korma',
    'Fish Moilee',
    'Fish Recheado',
    'Pomfret Fry',
    'Rohu Curry',
    'Hilsa Curry',
    'Mackerel Fry',
    'Sardine Curry',
    'Prawn Curry',
    'Prawn Masala',
    'Prawn Fry',
    'Crab Curry',
    'Crab Masala',
    'Squid Fry',
    'Prawn Koliwada',
    'Fish Pulusu',
  ],
  'fish'
)

// Street foods
addMany(
  [
    'Samosa',
    'Kachori',
    'Pani Puri',
    'Sev Puri',
    'Bhel Puri',
    'Dahi Puri',
    'Ragda Pattice',
    'Pav Bhaji',
    'Vada Pav',
    'Misal Pav',
    'Dabeli',
    'Chole Bhature',
    'Aloo Tikki',
    'Papdi Chaat',
    'Aloo Chaat',
    'Dhokla Chaat',
    'Khaman',
    'Veg Momos',
    'Chicken Momos',
    'Veg Chowmein',
    'Chicken Chowmein',
    'Frankie Roll (Veg)',
    'Frankie Roll (Chicken)',
    'Kathi Roll (Paneer)',
    'Kathi Roll (Chicken)',
    'Bread Pakora',
    'Mirchi Bajji',
    'Onion Pakora',
    'Gobi Manchurian (Dry)',
    'Paneer Manchurian',
    'Soya Chaap',
    'Tandoori Momos',
    'Kulcha Chole',
    'Idli Sambar',
    'Bhutta (Roasted Corn)',
    'Corn Chaat',
    'Chilli Potato',
    'Veg Spring Roll',
    'Chicken Spring Roll',
    'Paneer Roll',
  ],
  'street'
)

// Snacks and breakfast
addMany(
  [
    'Poha (Kanda)',
    'Poha (Batata)',
    'Upma (Rava)',
    'Dhokla',
    'Khandvi',
    'Handvo',
    'Besan Chilla',
    'Moong Chilla',
    'Sabudana Khichdi',
    'Sabudana Vada',
    'Masala Oats',
    'Daliya Porridge',
    'Ragi Porridge',
    'Sprout Salad',
    'Corn Chaat',
    'Aloo Toast',
    'Vegetable Sandwich',
    'Paneer Sandwich',
    'Idli Upma',
    'Poha Cutlet',
    'Methi Thepla (Snack)',
    'Cheela (Mixed Dal)',
    'Vermicelli Upma',
    'Suji Toast',
    'Rice Upma',
  ],
  'snack'
)

// Sweets and desserts
addMany(
  [
    'Gulab Jamun',
    'Jalebi',
    'Rasgulla',
    'Rasmalai',
    'Kheer',
    'Rice Kheer',
    'Vermicelli Kheer',
    'Gajar Halwa',
    'Suji Halwa',
    'Moong Dal Halwa',
    'Besan Ladoo',
    'Boondi Ladoo',
    'Motichoor Ladoo',
    'Coconut Ladoo',
    'Rava Ladoo',
    'Kaju Katli',
    'Badam Barfi',
    'Milk Cake',
    'Kalakand',
    'Sandesh',
    'Peda',
    'Mysore Pak',
    'Rabri',
    'Malpua',
    'Shrikhand',
    'Basundi',
    'Phirni',
    'Kulfi',
    'Falooda',
    'Imarti',
    'Chum Chum',
    'Soan Papdi',
    'Balushahi',
    'Modak',
    'Gujiya',
    'Til Ladoo',
    'Petha',
    'Pineapple Halwa',
    'Jaggery Chikki',
    'Nariyal Barfi',
  ],
  'sweet'
)

// Beverages
addMany(
  [
    'Masala Chai',
    'Ginger Tea',
    'Cardamom Tea',
    'Cutting Chai',
    'Filter Coffee',
    'Cold Coffee',
    'Lassi (Sweet)',
    'Lassi (Salted)',
    'Mango Lassi',
    'Buttermilk (Chaas)',
    'Nimbu Pani',
    'Jaljeera',
    'Aam Panna',
    'Thandai',
    'Sugarcane Juice',
    'Coconut Water',
    'Badam Milk',
    'Rose Milk',
    'Sattu Drink',
    'Sol Kadhi',
    'Kashmiri Kahwa',
    'Tulsi Tea',
    'Green Tea',
    'Black Tea',
    'Lemon Tea',
    'Banana Shake',
    'Mango Shake',
    'Papaya Shake',
    'Chikoo Shake',
    'Amla Juice',
  ],
  'beverage'
)

// Fruits
addMany(
  [
    'Apple',
    'Banana',
    'Mango',
    'Papaya',
    'Pomegranate',
    'Guava',
    'Orange',
    'Sweet Lime (Mosambi)',
    'Grapes',
    'Watermelon',
    'Muskmelon',
    'Pineapple',
    'Pear',
    'Peach',
    'Plum',
    'Apricot',
    'Kiwi',
    'Strawberry',
    'Blueberry',
    'Jamun',
    'Litchi',
    'Chikoo (Sapota)',
    'Custard Apple',
    'Jackfruit',
    'Fig',
    'Dates (Fresh)',
    'Amla',
    'Coconut (Raw)',
    'Avocado',
    'Dragon Fruit',
    'Passion Fruit',
    'Star Fruit',
    'Tamarind (Raw)',
    'Pomegranate Arils',
    'Pineapple Chunks',
  ],
  'fruit'
)

// Nuts and seeds
addMany(
  [
    'Almonds',
    'Cashews',
    'Pistachios',
    'Walnuts',
    'Peanuts',
    'Roasted Peanuts',
    'Sesame Seeds',
    'Flax Seeds',
    'Chia Seeds',
    'Pumpkin Seeds',
    'Sunflower Seeds',
    'Watermelon Seeds',
    'Fox Nuts (Makhana)',
    'Roasted Makhana',
    'Dry Coconut',
    'Raisins',
    'Dates (Dry)',
    'Figs (Dry)',
    'Hazelnuts',
    'Pine Nuts',
    'Brazil Nuts',
    'Poppy Seeds',
    'Melon Seeds',
    'Lotus Seeds',
    'Peanut Chikki',
  ],
  'nut'
)

// Packaged foods
addItems([
  { name: 'Parle-G Glucose Biscuits', brand: 'Parle', category: 'packaged_biscuit' },
  { name: 'Parle Krackjack Biscuits', brand: 'Parle', category: 'packaged_biscuit' },
  { name: 'Britannia Good Day Cookies', brand: 'Britannia', category: 'packaged_biscuit' },
  { name: 'Britannia Marie Gold Biscuits', brand: 'Britannia', category: 'packaged_biscuit' },
  { name: 'Britannia 50-50 Biscuits', brand: 'Britannia', category: 'packaged_biscuit' },
  { name: 'Sunfeast Dark Fantasy Cookies', brand: 'Sunfeast', category: 'packaged_biscuit' },
  { name: 'Sunfeast Marie Light Biscuits', brand: 'Sunfeast', category: 'packaged_biscuit' },
  { name: 'Oreo Original Biscuits', brand: 'Oreo', category: 'packaged_biscuit' },
  { name: 'Bourbon Biscuits', brand: 'Britannia', category: 'packaged_biscuit' },
  { name: 'Milk Bikis Biscuits', brand: 'Britannia', category: 'packaged_biscuit' },
  { name: 'Haldirams Bhujia Sev', brand: "Haldiram's", category: 'packaged_snack' },
  { name: 'Haldirams Aloo Bhujia', brand: "Haldiram's", category: 'packaged_snack' },
  { name: 'Haldirams Moong Dal Namkeen', brand: "Haldiram's", category: 'packaged_snack' },
  { name: 'Bikaji Bikaneri Bhujia', brand: 'Bikaji', category: 'packaged_snack' },
  { name: 'Balaji Aloo Sev', brand: 'Balaji', category: 'packaged_snack' },
  { name: 'Kurkure Masala Munch', brand: 'Kurkure', category: 'packaged_snack' },
  { name: "Lay's Magic Masala Chips", brand: "Lay's", category: 'packaged_snack' },
  { name: 'Uncle Chipps Classic Salted', brand: 'Uncle Chipps', category: 'packaged_snack' },
  { name: 'Bingo Mad Angles', brand: 'Bingo', category: 'packaged_snack' },
  { name: 'Bingo Tedhe Medhe', brand: 'Bingo', category: 'packaged_snack' },
  { name: 'Too Yumm Multigrain Chips', brand: 'Too Yumm', category: 'packaged_snack' },
  { name: 'Haldirams Aloo Lachha', brand: "Haldiram's", category: 'packaged_snack' },
  { name: 'Haldirams Khatta Meetha', brand: "Haldiram's", category: 'packaged_snack' },
  { name: 'Haldirams Navratan Mixture', brand: "Haldiram's", category: 'packaged_snack' },
  { name: 'Khatta Meetha Mix', brand: 'Bikaji', category: 'packaged_snack' },
  { name: 'Maggi 2-Minute Noodles', brand: 'Maggi', category: 'packaged_noodles' },
  { name: 'Top Ramen Curry Noodles', brand: 'Top Ramen', category: 'packaged_noodles' },
  { name: 'Yippee Magic Masala Noodles', brand: 'Yippee', category: 'packaged_noodles' },
  { name: "Ching's Secret Schezwan Noodles", brand: "Ching's", category: 'packaged_noodles' },
  { name: 'Maggi Masala Noodles', brand: 'Maggi', category: 'packaged_noodles' },
  { name: 'Knorr Soupy Noodles', brand: 'Knorr', category: 'packaged_noodles' },
  { name: 'MTR Ready-to-Eat Rajma Chawal', brand: 'MTR', category: 'packaged_snack' },
  { name: 'MTR Ready-to-Eat Paneer Butter Masala', brand: 'MTR', category: 'packaged_snack' },
  { name: 'MTR Ready-to-Eat Dal Makhani', brand: 'MTR', category: 'packaged_snack' },
  { name: 'MTR Ready-to-Eat Veg Pulao', brand: 'MTR', category: 'packaged_snack' },
  { name: 'Haldirams Frozen Paneer Tikka', brand: "Haldiram's", category: 'packaged_snack' },
  { name: 'Amul Taaza Milk', brand: 'Amul', category: 'packaged_dairy' },
  { name: 'Amul Gold Milk', brand: 'Amul', category: 'packaged_dairy' },
  { name: 'Amul Masti Dahi', brand: 'Amul', category: 'packaged_dairy' },
  { name: 'Amul Butter', brand: 'Amul', category: 'packaged_dairy' },
  { name: 'Amul Cheese Slice', brand: 'Amul', category: 'packaged_dairy' },
  { name: 'Amul Paneer', brand: 'Amul', category: 'packaged_dairy' },
  { name: 'Mother Dairy Classic Curd', brand: 'Mother Dairy', category: 'packaged_dairy' },
  { name: 'Mother Dairy Full Cream Milk', brand: 'Mother Dairy', category: 'packaged_dairy' },
  { name: 'Nestle Munch Chocolate', brand: 'Nestle', category: 'packaged_snack' },
  { name: 'Cadbury Dairy Milk Chocolate', brand: 'Cadbury', category: 'packaged_snack' },
  { name: 'Cadbury 5 Star Chocolate', brand: 'Cadbury', category: 'packaged_snack' },
  { name: 'Cadbury Gems', brand: 'Cadbury', category: 'packaged_snack' },
  { name: 'KitKat Chocolate', brand: 'Nestle', category: 'packaged_snack' },
  { name: 'Kissan Mixed Fruit Jam', brand: 'Kissan', category: 'packaged_snack' },
  { name: 'Frooti Mango Drink', brand: 'Frooti', category: 'packaged_drink' },
  { name: 'Maaza Mango Drink', brand: 'Maaza', category: 'packaged_drink' },
  { name: 'Slice Mango Drink', brand: 'Slice', category: 'packaged_drink' },
  { name: 'Real Mixed Fruit Juice', brand: 'Real', category: 'packaged_drink' },
  { name: 'Paper Boat Aam Panna', brand: 'Paper Boat', category: 'packaged_drink' },
  { name: 'Paper Boat Jaljeera', brand: 'Paper Boat', category: 'packaged_drink' },
  { name: 'Thums Up Cola', brand: 'Thums Up', category: 'packaged_drink' },
  { name: 'Limca Lemon Drink', brand: 'Limca', category: 'packaged_drink' },
  { name: 'Sprite Lemon Drink', brand: 'Sprite', category: 'packaged_drink' },
  { name: 'Coca-Cola', brand: 'Coca-Cola', category: 'packaged_drink' },
  { name: 'Appy Fizz', brand: 'Appy', category: 'packaged_drink' },
  { name: 'Red Bull Energy Drink', brand: 'Red Bull', category: 'packaged_drink' },
])

const foods = items.map(makeFood)

if (foods.length < 500) {
  throw new Error(`Expected at least 500 items, got ${foods.length}`)
}

const outPath = path.join(process.cwd(), 'data', 'indian-foods.json')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(foods, null, 2), 'utf8')

console.log(`Wrote ${foods.length} items to ${outPath}`)

'use client'

import { useMemo, useRef, useState } from 'react'
import type { Food, FoodLog } from '../../types/index'
import { useUser } from '../../hooks/useUser'
import { toast } from '../ui/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { getUtcDayRange } from '../../lib/dateUtils'
import { ArrowLeft, ChevronDown, Check, Drumstick, Droplet, Wheat, Sprout, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'

const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🥣' },
  { value: 'lunch',     label: 'Lunch',     emoji: '🍛' },
  { value: 'dinner',    label: 'Dinner',    emoji: '🍲' },
  { value: 'snack',     label: 'Snack',     emoji: '🥜' },
] as const

type MealValue = (typeof MEAL_OPTIONS)[number]['value']

const round1 = (n: number) => Math.round(n * 10) / 10

function defaultMeal(): MealValue {
  const hour = new Date().getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}

/** Pick an emoji based on the food name — fallback when we have no real image. */
function foodEmoji(name: string): string {
  const n = name.toLowerCase()
  if (/rice|chawal|biryani|pulao|khichdi/.test(n)) return '🍚'
  if (/roti|chapati|naan|paratha|bhatura|puri|thepla|makki/.test(n)) return '🫓'
  if (/dal|lentil|sambh?ar|rasam/.test(n)) return '🥣'
  if (/chicken|murgh|tandoori/.test(n)) return '🍗'
  if (/egg|anda|omelette|bhurji/.test(n)) return '🥚'
  if (/fish|machli|prawn|jhinga|rohu/.test(n)) return '🐟'
  if (/mutton|gosht/.test(n)) return '🍖'
  if (/paneer|cheese/.test(n)) return '🧀'
  if (/milk|lassi|chaas|dahi|curd|kheer/.test(n)) return '🥛'
  if (/idli|dosa|uttapam|appam|vada|puttu/.test(n)) return '🥞'
  if (/samosa|kachori|pakora/.test(n)) return '🥟'
  if (/pav|bhaji|momo/.test(n)) return '🥖'
  if (/gulab|jalebi|ladoo|barfi|halwa|peda|rasgulla/.test(n)) return '🍰'
  if (/banana|kela/.test(n)) return '🍌'
  if (/mango|aam/.test(n)) return '🥭'
  if (/apple/.test(n)) return '🍎'
  if (/watermelon|tarbooz/.test(n)) return '🍉'
  if (/grape|angoor/.test(n)) return '🍇'
  if (/coconut|nariyal/.test(n)) return '🥥'
  if (/almond|cashew|peanut|walnut|badam|kaju|moongfali/.test(n)) return '🥜'
  if (/tea|chai|coffee/.test(n)) return '☕'
  if (/water|juice|nimbu|panna/.test(n)) return '🥤'
  if (/aloo|potato|sabzi|vegetable|gobi|palak|bhindi|baingan|lauki|karela|methi/.test(n)) return '🥗'
  if (/oil|ghee|butter/.test(n)) return '🧈'
  if (/sugar|honey|jaggery|gur|shahad/.test(n)) return '🍯'
  if (/biscuit|maggi|noodle/.test(n)) return '🍪'
  return '🍽️'
}

type Unit = { key: string; label: string; toGrams: (q: number) => number }

/**
 * Smart portion lookup — takes precedence over serving_size_g and common_portions.
 * Covers any food source (USDA, OFF, IFCT, custom) by matching the food name.
 * Each entry has size variants so users pick Small / Medium / Large, not a mystery "Serving".
 */
type SmartPortion = { key: string; label: string; grams: number }
type SmartEntry   = { pattern: RegExp; portions: SmartPortion[]; defaultKey: string }

const SMART_PORTIONS: SmartEntry[] = [
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
  // ── DAL / CURRY ───────────────────────────────────────────────────────────
  {
    pattern: /dal|daal|lentil|sambh?ar|rasam/i,
    portions: [
      { key: 'small',  label: 'Small katori (120ml)', grams: 120 },
      { key: 'medium', label: 'Katori (200ml)',        grams: 200 },
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
  // ── STREET FOOD ───────────────────────────────────────────────────────────
  {
    pattern: /pav bhaji/i,
    portions: [
      { key: 'plate',  label: '1 plate — bhaji + 2 pav (280g)', grams: 280 },
      { key: 'half',   label: 'Half plate (150g)',               grams: 150 },
    ],
    defaultKey: 'plate',
  },
  {
    pattern: /pav/i,
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
]

function buildUnits(food: Food): Unit[] {
  const units: Unit[] = []

  // Always offer grams first (raw input)
  units.push({ key: 'g', label: 'Grams', toGrams: (q) => q })

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
  // 3. Last resort: use serving_size_g only if it's a realistic single serving (<= 250g and not the default 100g)
  else if (food.serving_size_g > 0 && food.serving_size_g !== 100) {
    units.push({
      key: 'serving',
      label: `1 serving (${food.serving_size_g}g)`,
      toGrams: (q) => q * food.serving_size_g,
    })
  }

  // Always offer ounces at the end
  units.push({ key: 'oz', label: 'Ounce (oz)', toGrams: (q) => q * 28.3495 })

  return units
}

function pickDefaultUnit(units: Unit[], food: Food): Unit {
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

export function AddFoodModal({ food, onClose }: { food: Food; onClose: () => void }) {
  const { user } = useUser()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inFlightRef = useRef(false)
  const queryClient = useQueryClient()

  const units = useMemo(() => buildUnits(food), [food])
  const [unit, setUnit] = useState<Unit>(() => pickDefaultUnit(units, food))
  const [quantityStr, setQuantityStr] = useState('1')
  const [meal, setMeal] = useState<MealValue>(defaultMeal())
  const [showUnitPicker, setShowUnitPicker] = useState(false)

  const quantityNum = Math.max(0, parseFloat(quantityStr) || 0)
  const grams = unit.toGrams(quantityNum)

  const nutrition = useMemo(() => {
    const factor = grams / 100
    return {
      kcal:    Math.round(food.kcal_per_100g      * factor),
      protein: round1(food.protein_g_per_100g * factor),
      carbs:   round1(food.carbs_g_per_100g   * factor),
      fat:     round1(food.fat_g_per_100g     * factor),
      fiber:   food.fiber_g_per_100g != null ? round1(food.fiber_g_per_100g * factor) : null,
    }
  }, [food, grams])

  const handleSubmit = async () => {
    if (inFlightRef.current || isSubmitting) return
    if (grams <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'error' })
      return
    }
    inFlightRef.current = true
    setIsSubmitting(true)
    try {
      if (!user) throw new Error('You must be signed in to log food.')

      const res = await fetch('/api/logs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food_id: food.id,
          meal,
          servings: 1,
          grams,
        }),
      })

      const body = await res.json().catch(() => ({} as { error?: string; row?: FoodLog }))

      if (!res.ok) throw new Error(body?.error || 'Failed to log food')

      // API now returns the full inserted row — update cache instantly (no refetch needed)
      if (body.row) {
        const { start } = getUtcDayRange()
        queryClient.setQueryData<FoodLog[]>(['food-logs', user.id, start], (old = []) => [body.row as FoodLog, ...(old ?? [])])
      } else {
        queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      }

      toast({ title: '✅ Food logged!', description: `${nutrition.kcal} kcal added to ${meal}`, duration: 2500 })
      onClose()
    } catch (err) {
      toast({ title: 'Failed to log food', description: (err as Error).message, variant: 'error', duration: 4000 })
    } finally {
      inFlightRef.current = false
      setIsSubmitting(false)
    }
  }

  const emoji = foodEmoji(food.name)

  return (
    <div className="fixed inset-0 z-50 bg-canvas flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-surface-2 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-ink" />
        </button>
        <div className="h-10 w-10" />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {/* Hero card */}
        <div className="relative rounded-sheet overflow-hidden h-44 mb-5 bg-brand-soft">
          <div className="absolute inset-0 flex items-center justify-center text-7xl opacity-90">
            {emoji}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent px-4 py-3">
            <p className="text-white text-lg font-bold leading-tight">{food.name}</p>
            {food.brand && <p className="text-white/80 text-xs font-medium">{food.brand}</p>}
          </div>
        </div>

        {/* Quantity + Measure */}
        <div className="rounded-card bg-surface border border-hairline p-3 mb-6">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-ink-2 font-medium mb-1.5 px-1">Quantity</p>
              <input
                type="number"
                inputMode="decimal"
                value={quantityStr}
                onChange={(e) => setQuantityStr(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="1"
                className="w-full h-12 rounded-control bg-surface-2 px-3 text-lg font-bold text-ink outline-none focus:ring-[3px] focus:ring-brand-ring transition-all"
              />
            </div>
            <div>
              <p className="text-xs text-ink-2 font-medium mb-1.5 px-1">Measure</p>
              <button
                type="button"
                onClick={() => setShowUnitPicker(true)}
                className="w-full h-12 rounded-control bg-surface-2 px-3 flex items-center justify-between text-left transition-all hover:bg-hairline"
              >
                <span className="text-base font-bold text-ink truncate">{unit.label}</span>
                <ChevronDown className="h-4 w-4 text-ink-2 flex-shrink-0 ml-1" />
              </button>
            </div>
          </div>
        </div>

        {/* Macronutrients Breakdown */}
        <p className="font-display text-base font-bold text-ink mb-3 px-1">Macronutrients Breakdown</p>

        <div className="rounded-card bg-surface border border-hairline p-4 mb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-ink-2 font-medium">Calories</p>
              <p className="font-display text-3xl font-bold text-ink mt-0.5 tabular-nums">
                {nutrition.kcal} <span className="text-base font-bold text-ink-2">Cal</span>
              </p>
            </div>
            <div className="bg-surface-2 rounded-control px-3 py-1.5">
              <p className="text-xs font-bold text-ink tabular-nums">Net wt: {Math.round(grams)} g</p>
            </div>
          </div>

          <div className="border-t border-hairline" />

          <div className="divide-y divide-hairline">
            <MacroRow icon={<Drumstick className="h-4 w-4" />} color="var(--protein)" label="Proteins" value={nutrition.protein} />
            <MacroRow icon={<Droplet    className="h-4 w-4" />} color="var(--fat)"     label="Fats"     value={nutrition.fat} />
            <MacroRow icon={<Wheat      className="h-4 w-4" />} color="var(--carbs)"   label="Carbs"    value={nutrition.carbs} />
            {nutrition.fiber != null && (
              <MacroRow icon={<Sprout className="h-4 w-4" />} color="var(--good)" label="Fiber" value={nutrition.fiber} />
            )}
          </div>
        </div>

        {/* Meal selector */}
        <p className="font-display text-base font-bold text-ink mb-3 px-1">Meal</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {MEAL_OPTIONS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMeal(m.value)}
              className={`rounded-control py-2.5 flex flex-col items-center gap-1 transition-all border ${
                meal === m.value
                  ? 'bg-brand-soft border-brand text-brand-ink'
                  : 'bg-surface border-hairline text-ink-2 hover:border-brand-ring'
              }`}
            >
              <span className="text-lg leading-none">{m.emoji}</span>
              <span className="text-[11px] font-bold">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sticky bottom Add button */}
      <div className="absolute inset-x-0 bottom-0 bg-canvas border-t border-hairline px-4 pt-3 pb-5 safe-area-inset-bottom">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || grams <= 0}
          className="w-full rounded-control bg-brand hover:opacity-90 active:scale-[.98] py-4 text-base font-bold text-white transition-all shadow-float disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Adding...</span>
            </>
          ) : (
            <span>Add</span>
          )}
        </button>
      </div>

      {/* Unit picker bottom sheet */}
      {showUnitPicker && (
        <UnitPicker
          foodName={food.name}
          units={units}
          selected={unit}
          onSelect={(u) => { setUnit(u); setShowUnitPicker(false) }}
          onClose={() => setShowUnitPicker(false)}
        />
      )}
    </div>
  )
}

function MacroRow({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <span style={{ color }}>{icon}</span>
        <span className="text-sm font-bold text-ink">{label}</span>
      </div>
      <span className="text-sm font-bold text-ink tabular-nums">{value} g</span>
    </div>
  )
}

function UnitPicker({
  foodName, units, selected, onSelect, onClose,
}: {
  foodName: string
  units: Unit[]
  selected: Unit
  onSelect: (u: Unit) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-sheet bg-surface px-4 pb-6 pt-3 shadow-float">
        <div className="mx-auto h-1 w-10 rounded-full bg-hairline mb-4" />
        <p className="text-center text-xs uppercase tracking-wide font-bold text-ink-2 mb-2">{foodName}</p>
        <div className="space-y-1.5 mb-4">
          {units.map((u) => {
            const isActive = u.key === selected.key
            return (
              <button
                key={u.key}
                type="button"
                onClick={() => onSelect(u)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-card transition-all ${
                  isActive
                    ? 'bg-brand-soft text-brand-ink'
                    : 'hover:bg-surface-2 text-ink'
                }`}
              >
                <span className={`text-base ${isActive ? 'font-bold' : 'font-semibold'}`}>{u.label}</span>
                {isActive && <Check className="h-5 w-5" />}
              </button>
            )
          })}
        </div>
        <Button type="button" size="lg" variant="outline" onClick={onClose} className="w-full tap-scale">
          Done
        </Button>
      </div>
    </div>
  )
}

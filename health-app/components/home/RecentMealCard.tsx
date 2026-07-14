import type { FoodLog } from '../../types/index'

// Ember Air "Recently logged" card (2c variant): a 64px thumbnail — the real
// meal photo when one exists, otherwise a food emoji on a soft-tinted tile so
// the list still reads as food at a glance — name + "Meal · time" caption, a
// small P/C/F row, and the kcal right-aligned. Photos light up automatically
// once meal-photo storage exists.

const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

// Keyword → emoji, ordered most-specific first. Tuned for Indian home cooking.
const EMOJI_RULES: [RegExp, string][] = [
  [/idli|dosa|uttapam|appam/i, '🥞'],
  [/roti|chapati|paratha|naan|bhatura|puri|thepla|kulcha/i, '🫓'],
  [/rice|chawal|biryani|pulao|pulav|khichdi|fried rice/i, '🍚'],
  [/noodle|maggi|pasta|chowmein|hakka|spaghetti/i, '🍜'],
  [/dal|sambar|rasam|kadhi|soup/i, '🍲'],
  [/paneer|matar|sabzi|bhaji|curry|masala|gravy|kofta|chana|rajma|chole|korma/i, '🍛'],
  [/egg|anda|omelet|bhurji/i, '🥚'],
  [/chicken|mutton|kebab|tikka|meat|keema/i, '🍗'],
  [/fish|prawn|seafood/i, '🐟'],
  [/lassi|chaas|chaach|buttermilk|milk|shake|smoothie/i, '🥛'],
  [/yogurt|curd|dahi|raita/i, '🥣'],
  [/chai|tea/i, '🍵'],
  [/coffee|latte|espresso/i, '☕'],
  [/samosa|pakora|kachori|vada|tikki|roll|spring|cutlet/i, '🥟'],
  [/laddu|barfi|halwa|jalebi|gulab|kheer|sweet|mithai|rasgulla|peda/i, '🍮'],
  [/ice cream|kulfi|falooda/i, '🍨'],
  [/chocolate|brownie/i, '🍫'],
  [/biscuit|cookie|rusk/i, '🍪'],
  [/cake|pastry|muffin/i, '🧁'],
  [/salad|sprout/i, '🥗'],
  [/oats|poha|upma|dalia|cereal|porridge|cornflake/i, '🥣'],
  [/nut|peanut|almond|cashew|badam|pista|walnut/i, '🥜'],
  [/potato|aloo|fries|chips/i, '🥔'],
  [/apple/i, '🍎'], [/banana|kela/i, '🍌'], [/mango|aam/i, '🥭'],
  [/orange|mosambi|citrus/i, '🍊'], [/grape/i, '🍇'], [/watermelon/i, '🍉'],
  [/fruit|papaya|guava|pomegranate|chikoo/i, '🍎'],
  [/bread|toast|sandwich|bun|pav/i, '🍞'],
  [/pizza/i, '🍕'], [/burger/i, '🍔'], [/taco|wrap|frankie/i, '🌯'],
  [/tofu|soya|soy/i, '🍱'],
  [/butter|ghee|oil/i, '🧈'],
  [/water|juice/i, '🧃'],
]

function foodEmoji(name: string): string {
  for (const [re, e] of EMOJI_RULES) if (re.test(name)) return e
  return '🍽️'
}

// Cycle a gentle tint by a stable hash of the name so the list has variety.
const TINTS = ['var(--protein)', 'var(--carbs)', 'var(--fat)', 'var(--good)', 'var(--brand)']
function tintFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return TINTS[h % TINTS.length]
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function RecentMealCard({ log, imageUrl }: { log: FoodLog; imageUrl?: string | null }) {
  const name = log.food?.name ?? 'Logged food'
  const mealLabel = MEAL_LABEL[log.meal] ?? log.meal
  const tint = tintFor(name)

  return (
    <div className="flex items-center gap-3.5 rounded-[20px] bg-surface p-3" style={{ boxShadow: 'var(--shadow-air)' }}>
      {/* Thumbnail: photo when available, tinted emoji tile otherwise */}
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
        style={imageUrl ? undefined : { backgroundColor: `color-mix(in srgb, ${tint} 14%, transparent)` }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[28px] leading-none" aria-hidden="true">{foodEmoji(name)}</span>
        )}
      </div>

      {/* Name + caption */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold text-ink">{name}</p>
        <p className="mt-[3px] text-[12px] text-ink-3">{mealLabel} · {formatTime(log.logged_at)}</p>
      </div>

      {/* Kcal */}
      <div className="shrink-0 text-right">
        <p className="text-[15px] font-bold tabular-nums text-ink">{Math.round(log.kcal)}</p>
        <p className="mt-[1px] text-[10.5px] text-ink-3">kcal</p>
      </div>
    </div>
  )
}

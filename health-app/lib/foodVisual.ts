// Shared food-tile visuals for the Ember Air lists (Home "Recently logged",
// Food "Log again"). No meal photos are stored, so we show a recognisable food
// emoji on a softly macro-tinted tile. Keyword map tuned for Indian home food.

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

export function foodEmoji(name: string): string {
  for (const [re, e] of EMOJI_RULES) if (re.test(name)) return e
  return '🍽️'
}

const TINTS = ['var(--protein)', 'var(--carbs)', 'var(--fat)', 'var(--good)', 'var(--brand)']

/** Stable soft tint for a name, so lists have gentle colour variety. */
export function tintFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return TINTS[h % TINTS.length]
}

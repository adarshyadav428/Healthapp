/**
 * lib/food-synonyms.ts
 *
 * Indian food synonym map. When a user searches for any term in a synonym
 * group, we expand the query to include all variants so the DB search finds
 * the food regardless of which spelling or regional name was used.
 *
 * Rules:
 * - Keep synonyms lowercase
 * - More specific entries (branded) come after generic ones
 * - Each group is keyed by the canonical DB name (or closest match)
 */

export const foodSynonyms: Record<string, string[]> = {
  // ── GENERIC DAL (catches "daal", "dhal", "dhall" spelling variants) ────────
  'dal': ['dal', 'daal', 'dhal', 'dhall', 'lentil', 'lentils', 'dal fry', 'dal soup'],

  // ── SOYA ──────────────────────────────────────────────────────────────────
  'soya chunks': ['soya chunks', 'soy chunks', 'meal maker', 'textured soy protein', 'nutrela', 'soyabean chunks', 'tsp chunks'],
  'soya': ['soya', 'soy', 'soyabean', 'soybean'],

  // ── DAIRY ─────────────────────────────────────────────────────────────────
  'chaas': ['chaas', 'chhaas', 'buttermilk', 'amul chaas', 'masala chaas', 'mattha', 'takra'],
  'dahi': ['dahi', 'curd', 'yogurt', 'yoghurt', 'doi', 'curds'],
  'paneer': ['paneer', 'cottage cheese', 'chenna', 'chena'],
  'lassi': ['lassi', 'sweet lassi', 'salted lassi', 'mango lassi'],
  'kheer': ['kheer', 'rice pudding', 'payasam', 'payesh', 'phirni'],
  'dudh': ['dudh', 'milk', 'doodh'],

  // ── LENTILS & PULSES ──────────────────────────────────────────────────────
  'toor dal': ['toor dal', 'arhar dal', 'tuvar dal', 'pigeon pea', 'toovar', 'toor', 'arhar', 'toor daal', 'arhar daal'],
  'chana': ['chana', 'chole', 'chickpea', 'kabuli chana', 'garbanzo', 'chhole', 'channay'],
  'rajma': ['rajma', 'kidney beans', 'red kidney beans', 'rajmah'],
  'moong': ['moong', 'mung', 'moong dal', 'moong daal', 'green gram', 'mung dal', 'moong beans'],
  'urad': ['urad', 'urad dal', 'urad daal', 'black gram', 'black lentil', 'urad dhal'],
  'masoor': ['masoor', 'masoor dal', 'masoor daal', 'red lentil', 'lal masoor', 'masur'],
  'chana dal': ['chana dal', 'chana daal', 'bengal gram', 'split chickpea', 'dhuli chana'],

  // ── BREADS ────────────────────────────────────────────────────────────────
  'roti': ['roti', 'chapati', 'chapatti', 'chapathi', 'chappathi', 'phulka', 'fulka', 'safed roti', 'wheat roti'],
  'paratha': ['paratha', 'parantha', 'parauntha', 'parotha'],
  'puri': ['puri', 'poori', 'bhatura', 'bhature'],
  'naan': ['naan', 'nan', 'tandoori naan', 'garlic naan'],
  'bread': ['bread', 'white bread', 'brown bread', 'whole wheat bread', 'sandwich bread', 'toast', 'toasted bread'],
  'atta': ['atta', 'aata', 'aatta', 'wheat flour', 'whole wheat flour', 'gehun atta'],

  // ── RICE & RICE DISHES ────────────────────────────────────────────────────
  'chawal': ['chawal', 'rice', 'boiled rice', 'steamed rice', 'cooked rice', 'plain rice'],
  'biryani': ['biryani', 'biriyani', 'birayni', 'biriani'],
  'pulao': ['pulao', 'pilaf', 'pilau', 'pulav'],
  'khichdi': ['khichdi', 'khichri', 'khichari', 'kichadi'],
  'oats': ['oats', 'oatmeal', 'rolled oats', 'instant oats', 'quaker oats', 'daliya oats', 'porridge'],

  // ── VEGETABLES & SABZIS ───────────────────────────────────────────────────
  'tamatar': ['tamatar', 'tomato', 'tomatoes', 'tamaatar'],
  'pyaaz': ['pyaaz', 'pyaz', 'piaz', 'onion', 'onions', 'kanda', 'dungri'],
  'gajar': ['gajar', 'carrot', 'carrots', 'gaajar'],
  'kheera': ['kheera', 'kheera', 'kakdi', 'kakadi', 'cucumber', 'cucumbers'],
  'patta gobi': ['patta gobi', 'patta gobhi', 'band gobi', 'cabbage', 'bandh gobi'],
  'adrak': ['adrak', 'ginger', 'adarak'],
  'lahsun': ['lahsun', 'garlic', 'lasun', 'lehsun'],
  'chukandar': ['chukandar', 'beetroot', 'beet', 'chukander'],
  'mooli': ['mooli', 'radish', 'muli', 'white radish'],
  'shakarkand': ['shakarkand', 'sweet potato', 'shakarkandi'],
  'bhindi': ['bhindi', 'okra', 'ladies finger', 'lady finger', 'ladyfinger'],
  'baingan': ['baingan', 'brinjal', 'eggplant', 'aubergine', 'baingun'],
  'palak': ['palak', 'spinach', 'paalak'],
  'gobi': ['gobi', 'gobhi', 'cauliflower', 'phool gobi', 'phoolgobi'],
  'shimla mirch': ['shimla mirch', 'capsicum', 'bell pepper', 'sweet pepper'],
  'karela': ['karela', 'bitter gourd', 'bitter melon', 'kerela'],
  'lauki': ['lauki', 'bottle gourd', 'ghiya', 'doodhi', 'dudhi'],
  'tori': ['tori', 'turai', 'ridge gourd', 'luffa'],
  'aloo': ['aloo', 'alu', 'potato', 'aloo sabzi'],
  'matar': ['matar', 'peas', 'green peas', 'muttar'],
  'methi': ['methi', 'fenugreek leaves', 'fenugreek'],
  // Corn has more regional names than almost anything else on an Indian street
  // cart, and none of them share a substring — a "makki" search would never
  // reach "Bhutta (Roasted Corn)". Order matters: `buildNameIlikeOrFilter` keeps
  // only the first 6 terms, so the widely-typed ones come first.
  'bhutta': ['bhutta', 'corn', 'makki', 'makkai', 'maize', 'challi', 'butta', 'bhutte', 'makka', 'makai', 'chhalli', 'mokka jonna', 'sweet corn', 'roasted corn', 'corn on the cob'],
  'sarson': ['sarson', 'sarso', 'mustard greens', 'saag'],

  // ── EGGS ──────────────────────────────────────────────────────────────────
  'anda': ['anda', 'egg', 'eggs', 'anday', 'baida', 'ande', 'boiled egg', 'egg boiled'],

  // ── SOUTH INDIAN ──────────────────────────────────────────────────────────
  'sambar': ['sambar', 'sambhar', 'sambaru', 'sambar curry', 'sambar rice', 'sambhar curry', 'south indian dal'],
  'idli sambar': ['idli sambar', 'idly sambhar', 'idli sambhar'],
  'rasam': ['rasam', 'rasam soup', 'tomato rasam', 'pepper rasam'],

  // ── NORTH INDIAN CURRIES ──────────────────────────────────────────────────
  'kadhi': ['kadhi', 'kadi', 'kadhi pakora', 'kadhi chawal', 'punjabi kadhi', 'besan kadhi', 'gujarati kadhi'],
  'aloo choka': ['aloo choka', 'alu choka', 'chokha', 'aloo chokha', 'bihari chokha', 'choka'],
  'dum aloo': ['dum aloo', 'aloo dum', 'dam aloo', 'kashmiri dum aloo'],
  'aloo matar': ['aloo matar', 'aloo mattar', 'potato peas curry', 'matar aloo'],
  'keema matar': ['keema matar', 'kheema matar', 'mince peas', 'qeema matar'],
  'rajma chawal': ['rajma chawal', 'rajma rice', 'kidney bean rice'],

  // ── CHICKEN & NON-VEG ─────────────────────────────────────────────────────
  'murgi': ['murgi', 'chicken', 'murgha', 'murg', 'murgh'],
  'butter chicken': ['butter chicken', 'murgh makhani', 'chicken makhani'],
  'chicken tikka': ['chicken tikka', 'tikka', 'chicken tikka masala', 'tikka pieces', 'grilled chicken tikka'],
  'tandoori': ['tandoori', 'tandoori chicken', 'tanduri'],
  'seekh kebab': ['seekh kebab', 'shish kebab', 'chicken seekh', 'mutton seekh', 'seekh', 'kebab'],
  'keema': ['keema', 'kheema', 'minced meat', 'qeema', 'mince'],
  'mutton': ['mutton', 'lamb', 'gosht', 'bakra'],

  // ── BREAKFAST ─────────────────────────────────────────────────────────────
  'poha': ['poha', 'pohe', 'flattened rice', 'beaten rice', 'flaked rice'],
  'upma': ['upma', 'uppma', 'uppumavu'],
  'idli': ['idli', 'idly', 'idlies', 'idlis'],
  'dosa': ['dosa', 'dosai', 'dose', 'dosha'],
  'uttapam': ['uttapam', 'oothappam', 'uthappam'],
  'vada': ['vada', 'wada', 'medu vada', 'uzhunnu vada'],
  'dhokla': ['dhokla', 'dhokra'],
  'daliya': ['daliya', 'broken wheat', 'lapsi', 'gehun daliya', 'wheat porridge'],

  // ── FRUITS ────────────────────────────────────────────────────────────────
  'seb': ['seb', 'apple', 'apples', 'safed seb'],
  'santra': ['santra', 'narangi', 'orange', 'oranges', 'kamala'],
  'kela': ['kela', 'banana', 'bananas', 'plantain'],
  'aam': ['aam', 'mango', 'mangoes', 'alphonso', 'hapus', 'kesari'],
  'angoor': ['angoor', 'grapes', 'grape', 'draksh'],
  'nashpati': ['nashpati', 'pear', 'pears', 'naspati'],

  // ── SNACKS & STREET FOOD ──────────────────────────────────────────────────
  'samosa': ['samosa', 'samoosa', 'samusa'],
  'pakora': ['pakora', 'pakoda', 'bhajia', 'bajji', 'bhaji'],
  'bhel': ['bhel', 'bhel puri', 'bhelpuri'],
  'pani puri': ['pani puri', 'golgappa', 'gol gappa', 'puchka', 'gup chup', 'panipuri'],
  'vada pav': ['vada pav', 'wada pav', 'vada paav', 'vada pao'],
  'kachori': ['kachori', 'kachodi', 'kachauree'],
  'namkeen': ['namkeen', 'mixture', 'farsan', 'chivda', 'chevda'],

  // ── DRINKS ────────────────────────────────────────────────────────────────
  'chai': ['chai', 'tea', 'milk tea', 'cutting chai', 'masala chai', 'chiya'],
  'nimbu pani': ['nimbu pani', 'lemonade', 'shikanjvi', 'nimbu paani', 'lemon water'],
  'coconut water': ['coconut water', 'nariyal pani', 'tender coconut water'],

  // ── COOKING ESSENTIALS ────────────────────────────────────────────────────
  'ghee': ['ghee', 'clarified butter', 'desi ghee', 'cow ghee'],
  'maida': ['maida', 'all purpose flour', 'refined flour', 'plain flour'],
  'besan': ['besan', 'gram flour', 'chickpea flour', 'chana flour'],
  'suji': ['suji', 'sooji', 'semolina', 'rava', 'rawa', 'cream of wheat'],
  'oil': ['oil', 'cooking oil', 'tel', 'sunflower oil', 'refined oil'],
  'sabzi': ['sabzi', 'sabji', 'sabzee', 'subzi', 'curry', 'vegetable curry'],
  'mixed vegetable': ['mixed vegetable', 'mix veg', 'mix sabzi', 'mixed sabzi', 'veg curry', 'vegetables'],
  'fried rice': ['fried rice', 'veg fried rice', 'chinese rice', 'indo chinese rice'],
  'jeera rice': ['jeera rice', 'zeera rice', 'cumin rice', 'jeera chawal'],
  'egg curry': ['egg curry', 'anda curry', 'ande ki sabzi', 'anda masala', 'boiled egg curry'],
  'momos': ['momos', 'momo', 'steamed momos', 'fried momos', 'dumpling', 'dimsim'],

  // ── BRANDS ────────────────────────────────────────────────────────────────
  'amul butter': ['amul butter', 'amul', 'butter', 'salted butter'],
  'amul chaas': ['amul chaas', 'amul buttermilk'],
  'amul dahi': ['amul dahi', 'amul curd'],
  'amul paneer': ['amul paneer'],
  'maggi': ['maggi', 'maggi noodles', '2 minute noodles', 'instant noodles'],
  'nutrela': ['nutrela', 'nutrela soya chunks', 'soya chunks nutrela'],
}

/**
 * Expand a raw search query into all known synonym variants.
 * Returns a deduplicated array — original query is always first.
 *
 * Example: "arhar dal" → ["arhar dal", "toor dal", "tuvar dal", "pigeon pea", ...]
 */
export function expandSearchQuery(query: string): string[] {
  const lower = query.toLowerCase().trim()
  const queries = new Set<string>([lower])

  for (const [canonical, synonyms] of Object.entries(foodSynonyms)) {
    // Match if any synonym contains the query OR the query contains any synonym
    const matched = synonyms.some(
      (s) => lower.includes(s) || s.includes(lower)
    )
    if (matched) {
      synonyms.forEach((s) => queries.add(s))
      queries.add(canonical)
    }
  }

  // Always keep the original query first for relevance sorting
  const result = [lower, ...Array.from(queries).filter((q) => q !== lower)]
  return result
}

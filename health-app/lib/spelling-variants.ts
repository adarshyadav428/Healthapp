/**
 * lib/spelling-variants.ts
 *
 * Romanisation folding for food-name ranking. Nobody agrees how to spell an
 * Indian food in the Latin alphabet, and `lib/searchRanking.ts` scores the word
 * the user typed against the name *literally* — so two spellings of one word are
 * two different words to it.
 *
 * The scar: searching "daal" put Haldiram's "Moong Daal" (a fried namkeen) above
 * every cooked lentil we hold. The packaged row is the only one in the table
 * spelled the way the user typed, so it scored a perfect typed-word match (3)
 * while "Moong Dal (Yellow)" [ifct] scored 0 and fell to the synonym tier —
 * winning before SOURCE_RANK (ifct 6 > off_india 3) was ever consulted. Typing
 * "dal" worked fine. Folding both sides to one spelling puts the tie back where
 * it belongs: on source trust.
 *
 * Rules for adding an entry — all three must hold:
 *
 * 1. **Spelling only.** A respelling of the same word, never a translation or a
 *    different regional word. `daal → dal` yes; `lentil → dal`, `corn → bhutta`,
 *    `curd → dahi` NO — those belong in `lib/food-synonyms.ts` and must keep
 *    flowing through the *synonym* tier. Folding a translation into the typed
 *    tier recreates the "bhutta returns Cornflakes" bug that tier exists to stop.
 * 2. **Single lowercase alphabetic words** on both sides. Multi-word variants
 *    fold for free, word by word ("moong daal" → "moong dal").
 * 3. **Not a common English word or brand token in another context.** `nan` is
 *    excluded because Nestlé NAN infant formula would fold into naan queries;
 *    likewise `dose` (dosai), `mince` (keema), `bhajia` (a fritter, not pav
 *    bhaji's curry).
 *
 * `tests/spellingVariants.test.ts` pins these as invariants, including that no
 * two distinct foods ever fold to the same token.
 */
export const SPELLING_VARIANTS: Record<string, string> = {
  // ── Lentils & pulses ──────────────────────────────────────────────────────
  daal: 'dal',
  dhal: 'dal',
  dhall: 'dal',
  arahar: 'arhar',
  tuvar: 'toor',
  toovar: 'toor',
  mung: 'moong',
  masur: 'masoor',
  chhole: 'chole',
  rajmah: 'rajma',

  // ── Breads ────────────────────────────────────────────────────────────────
  chapatti: 'chapati',
  chapathi: 'chapati',
  chappathi: 'chapati',
  fulka: 'phulka',
  parantha: 'paratha',
  parauntha: 'paratha',
  parotha: 'paratha',
  poori: 'puri',
  aata: 'atta',
  aatta: 'atta',

  // ── Rice & grains ─────────────────────────────────────────────────────────
  biriyani: 'biryani',
  birayni: 'biryani',
  biriani: 'biryani',
  pulav: 'pulao',
  pilau: 'pilaf',
  khichri: 'khichdi',
  khichari: 'khichdi',
  kichadi: 'khichdi',
  zeera: 'jeera',
  sooji: 'suji',
  rawa: 'rava',

  // ── Vegetables ────────────────────────────────────────────────────────────
  tamaatar: 'tamatar',
  pyaz: 'pyaaz',
  piaz: 'pyaaz',
  gaajar: 'gajar',
  kakadi: 'kakdi',
  adarak: 'adrak',
  lasun: 'lahsun',
  lehsun: 'lahsun',
  chukander: 'chukandar',
  muli: 'mooli',
  shakarkandi: 'shakarkand',
  baingun: 'baingan',
  paalak: 'palak',
  gobhi: 'gobi',
  kerela: 'karela',
  doodhi: 'dudhi',
  alu: 'aloo',
  muttar: 'matar',
  mattar: 'matar',
  sarso: 'sarson',
  arvi: 'arbi',
  naariyal: 'nariyal',

  // ── Corn (the most-respelled food on an Indian street cart) ───────────────
  butta: 'bhutta',
  bhutte: 'bhutta',
  makkai: 'makki',
  makai: 'makki',
  makka: 'makki',
  chhalli: 'challi',

  // ── South Indian ──────────────────────────────────────────────────────────
  sambhar: 'sambar',
  sambaru: 'sambar',
  idly: 'idli',
  dosha: 'dosa',
  oothappam: 'uttapam',
  ootappam: 'uttapam',
  uthappam: 'uttapam',
  uttappam: 'uttapam',
  uthapam: 'uttapam',
  wada: 'vada',
  uppma: 'upma',

  // ── Curries & non-veg ─────────────────────────────────────────────────────
  kadi: 'kadhi',
  chokha: 'choka',
  kheema: 'keema',
  qeema: 'keema',
  machhli: 'machli',
  machchi: 'machli',
  tanduri: 'tandoori',
  kabab: 'kebab',

  // ── Dairy ─────────────────────────────────────────────────────────────────
  chhaas: 'chaas',
  chach: 'chaas',
  chaach: 'chaas',
  mattha: 'matha',
  yoghurt: 'yogurt',
  doodh: 'dudh',
  chenna: 'chhena',
  chena: 'chhena',
  chhana: 'chhena',
  ghi: 'ghee',

  // ── Snacks & street food ──────────────────────────────────────────────────
  samoosa: 'samosa',
  samusa: 'samosa',
  pakoda: 'pakora',
  kachodi: 'kachori',
  kachauree: 'kachori',
  chevda: 'chivda',
  murmure: 'murmura',
  kurmura: 'murmura',
  paav: 'pav',

  // ── Sweets ────────────────────────────────────────────────────────────────
  laddu: 'ladoo',
  laddoo: 'ladoo',
  ladu: 'ladoo',
  rosogolla: 'rasgulla',
  roshogolla: 'rasgulla',
  rossogolla: 'rasgulla',
  rasgola: 'rasgulla',
  rasagola: 'rasgulla',
  burfi: 'barfi',
  burfee: 'barfi',
  barfee: 'barfi',

  // ── Fruits & dry fruits ───────────────────────────────────────────────────
  naspati: 'nashpati',
  annanas: 'ananas',
  anannas: 'ananas',
  khajur: 'khajoor',
  chhuara: 'chuhara',
  anjir: 'anjeer',

  // ── Everything else ───────────────────────────────────────────────────────
  soy: 'soya',
  soybean: 'soyabean',
  sabji: 'sabzi',
  sabzee: 'sabzi',
  subzi: 'sabzi',
  paani: 'pani',
}

/**
 * Fold every alphabetic run in `text` to its canonical spelling.
 *
 * Operates on alphabetic runs rather than whitespace-separated words so that
 * punctuation survives untouched — `nameReadings` in `lib/searchRanking.ts`
 * depends on `(`, `)` and `/` to tell a name from its regional gloss, and a
 * word glued to a bracket ("(Arhar Dal)") must still fold.
 *
 * Expects lowercase input; every caller normalises first.
 */
export function foldSpelling(text: string): string {
  return text.replace(/[a-z]+/g, (word) => SPELLING_VARIANTS[word] ?? word)
}

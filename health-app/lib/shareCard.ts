/**
 * Share cards — brand images rendered client-side to a canvas and handed to the
 * Web Share API (WhatsApp/Instagram on Android) with a download fallback.
 *
 * Two cards:
 *  - the **stat card** (weight lost, streak, deficit) — a name, one number
 *  - the **day card** — a day's meals as a menu, under the day's total
 *
 * Two formats each: `square` (1080×1080) for a feed post or a chat, and `story`
 * (1080×1920) for WhatsApp status and Instagram stories — a square posted to a
 * story floats in a grey box, which is where most of these actually go.
 *
 * Data prep is pure (tested); drawing takes the prepared data. The palette is
 * pinned — a share card leaves the app and must render identically for every
 * viewer, which is why these hex values live here (lib/ is outside the
 * check-tokens scan) and not in a component.
 */

export type ShareCardData = {
  hero: {
    value: string
    /** Set separately from `value` so the two can carry different faces. */
    unit?: string
    label: string
  }
  /** The card's second true stat, drawn as an outlined chip. */
  subline: string | null
}

/** What the card leads with. The user picks; the app no longer guesses. */
export type ShareTopic = 'weight' | 'streak' | 'deficit'

export type ShareCardOption = {
  topic: ShareTopic
  /** Row label in the chooser. */
  label: string
  data: ShareCardData
}

export type ShareDeficit = {
  /** Total kcal under maintenance for the period. Positive = a deficit. */
  kcal: number
  period: 'week' | 'month'
  daysLogged: number
  /** What that deficit is worth in fat, from the same summary. */
  fatKg: number
}

export type ShareCardInput = {
  streakDays: number
  /** Kilos below the starting weight. Null when unknown; negatives are ignored. */
  kgLost: number | null
  /** Null when the period has nothing finished in it, or when it is withheld. */
  deficit: ShareDeficit | null
  /**
   * How the weight loss is described. Defaults to "since I started" — the
   * monthly Wrapped overrides it with the month, because a wrap's numbers cover
   * one month and a card claiming a lifetime total would be false.
   */
  sinceLabel?: string
}

/** Kilos lost, or null — the one subtraction every caller was doing by hand. */
export function kgLostFrom(startKg: number | null, currentKg: number | null): number | null {
  if (startKg == null || currentKg == null) return null
  return startKg - currentKg
}

/**
 * The byline name, from `profiles.display_name`.
 *
 * First token only: display_name usually holds a full name, and a two-line
 * byline would break the card's vertical rhythm. Returns null for an anonymous
 * account (migration 026 — display_name is nullable), and the card then omits
 * the line entirely rather than drawing a blank one.
 */
export function firstNameFrom(displayName: string | null | undefined): string | null {
  if (!displayName) return null
  const first = displayName.trim().split(/\s+/)[0]
  if (!first) return null
  return first.length > 16 ? first.slice(0, 16) : first
}

function formatKcal(kcal: number): string {
  return Math.round(kcal).toLocaleString('en-IN')
}

/**
 * Every topic that has something to say, strongest first.
 *
 * The order only sets which row is preselected — the user picks — but it still
 * has to be defensible, so it is a fixed rank rather than a feeling: a kilo or
 * more outranks any streak, a week-long streak outranks a smaller loss, and the
 * deficit is always last because it is the least legible number to the friend
 * looking at the status. Returns [] when there is nothing worth posting yet,
 * and callers hide the button.
 */
export function buildShareCardOptions(input: ShareCardInput): ShareCardOption[] {
  const { streakDays, kgLost, deficit, sinceLabel = 'since I started' } = input
  const ranked: { rank: number; option: ShareCardOption }[] = []

  // Sub-0.1 kg is scale noise, and a gain is never bragged about.
  const hasLoss = kgLost != null && kgLost >= 0.1

  if (hasLoss) {
    const kg = kgLost as number
    ranked.push({
      rank: kg >= 1 ? 0 : 2,
      option: {
        topic: 'weight',
        label: 'Weight lost',
        data: {
          hero: { value: kg.toFixed(1), unit: 'kg', label: `down ${sinceLabel}` },
          subline: streakDays >= 1 ? `${streakDays}-day logging streak` : null,
        },
      },
    })
  }

  if (streakDays >= 1) {
    ranked.push({
      rank: streakDays >= 7 ? 1 : 3,
      option: {
        topic: 'streak',
        label: 'Streak',
        data: {
          hero: {
            value: String(streakDays),
            unit: streakDays === 1 ? 'day' : 'days',
            label: 'logged in a row',
          },
          subline: hasLoss ? `${(kgLost as number).toFixed(1)} kg down ${sinceLabel}` : null,
        },
      },
    })
  }

  // Deficit is `maintenance − eaten` (lib/deficit-calculator.ts), and the label
  // has to name that benchmark: the same number is a miss against an eat-goal
  // and the best week of the month against maintenance.
  if (deficit && deficit.kcal > 0 && deficit.daysLogged > 0) {
    const period = deficit.period === 'week' ? 'This week' : 'This month'
    ranked.push({
      rank: 4,
      option: {
        topic: 'deficit',
        label: `${period}'s deficit`,
        data: {
          hero: { value: formatKcal(deficit.kcal), unit: 'kcal', label: 'under maintenance' },
          subline: `${period} · ${deficit.daysLogged} ${
            deficit.daysLogged === 1 ? 'day' : 'days'
          } logged · ${deficit.fatKg.toFixed(2)} kg of fat`,
        },
      },
    })
  }

  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.option)
}

/* ------------------------------------------------------------------ *
 * The day card — a day's meals as a menu
 * ------------------------------------------------------------------ */

export type DayCardMealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/** One row of the menu. */
export type DayCardItem = { name: string; kcal: number }

export type DayCardMeal = {
  slot: DayCardMealSlot
  label: string
  kcal: number
  items: DayCardItem[]
  /** Items dropped to fit the card. 0 in the normal case. */
  hiddenItems: number
}

export type DayCardData = {
  /** "Tuesday, 26 August" — already formatted, so drawing stays dumb. */
  dateLabel: string
  meals: DayCardMeal[]
  totalKcal: number
  /** "P 96g · C 210g · F 58g", or null when nothing carries macros. */
  macroLine: string | null
}

export type DayCardLog = {
  meal: DayCardMealSlot
  name: string | null
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

const MEAL_ORDER: { slot: DayCardMealSlot; label: string }[] = [
  { slot: 'breakfast', label: 'Breakfast' },
  { slot: 'lunch', label: 'Lunch' },
  { slot: 'dinner', label: 'Dinner' },
  { slot: 'snack', label: 'Snack' },
]

/** 1080×1080 for a post or a chat; 1080×1920 for status and stories. */
export type ShareFormat = 'square' | 'story'

/**
 * A card can only hold so many lines before the menu runs into the footer.
 * Past the budget the longest meals give up their last items, and the card says
 * so rather than silently truncating — a menu missing a dish with no
 * acknowledgement is a lie about what someone ate.
 *
 * A square has roughly half the vertical room of a story once the total and the
 * footer are paid for, hence two budgets rather than one.
 */
export const MAX_ITEM_LINES: Record<ShareFormat, number> = { story: 12, square: 6 }

/**
 * Group a day's logs into the menu, in meal order, clamped to fit.
 *
 * Pure and takes rows as arguments, like every other module here — callers do
 * their own fetching. Returns null when the day holds nothing, and callers hide
 * the button.
 */
export function buildDayCardData(args: {
  dateLabel: string
  logs: DayCardLog[]
  /** Defaults to the story budget — the format most of these are posted in. */
  maxItemLines?: number
}): DayCardData | null {
  const { dateLabel, logs, maxItemLines = MAX_ITEM_LINES.story } = args
  if (logs.length === 0) return null

  const meals: DayCardMeal[] = []
  for (const { slot, label } of MEAL_ORDER) {
    const rows = logs.filter((l) => l.meal === slot)
    if (rows.length === 0) continue
    meals.push({
      slot,
      label,
      kcal: Math.round(rows.reduce((s, l) => s + l.kcal, 0)),
      items: rows.map((l) => ({ name: l.name?.trim() || 'Quick add', kcal: Math.round(l.kcal) })),
      hiddenItems: 0,
    })
  }
  if (meals.length === 0) return null

  // Trim to the line budget by repeatedly taking one item off whichever meal is
  // currently longest — so a day of one huge lunch and three small meals loses
  // lunch items, not the meals that only had one thing in them.
  let lines = meals.reduce((s, m) => s + m.items.length, 0)
  while (lines > maxItemLines) {
    let longest = meals[0]
    for (const m of meals) if (m.items.length > longest.items.length) longest = m
    if (longest.items.length <= 1) break
    longest.items.pop()
    longest.hiddenItems += 1
    lines -= 1
  }

  const p = Math.round(logs.reduce((s, l) => s + (l.proteinG || 0), 0))
  const c = Math.round(logs.reduce((s, l) => s + (l.carbsG || 0), 0))
  const f = Math.round(logs.reduce((s, l) => s + (l.fatG || 0), 0))

  return {
    dateLabel,
    meals,
    totalKcal: Math.round(logs.reduce((s, l) => s + l.kcal, 0)),
    macroLine: p + c + f > 0 ? `P ${p}g · C ${c}g · F ${f}g` : null,
  }
}

/* ------------------------------------------------------------------ *
 * Drawing
 * ------------------------------------------------------------------ */

/**
 * Editorial Light. Pinned — none of this reads a theme token.
 *
 * The ground is near-white on purpose, not cream. An earlier version copied the
 * app's `--canvas` and put a white plate on a near-white ground at 1.03:1,
 * which is why the card read as a pale blob. Warmth now comes from an ember
 * bloom behind the numeral rather than from beige paper.
 *
 * The accent is deliberately deep: `#FF8A50` on this ground is 2.2:1 and
 * unreadable as text. Every value below is checked against its own ground.
 */
const PALETTE = {
  groundTop:  '#FFFCF9',
  groundBot:  '#FFF7F1',
  magInk:     '#1A1208',   // hero numeral — ~15:1
  wordmark:   '#1F1710',
  label:      '#574838',   // 8.2:1
  name:       '#B0450F',   // 4.9:1
  unit:       '#C24E1E',   // 4.5:1
  chipText:   '#3E3226',
  chipBorder: 'rgba(31,23,16,.20)',
  chipFill:   'rgba(31,23,16,.03)',
  dot:        '#E8551C',
  tagline:    '#C24E1E',
  url:        '#7A6A5C',   // 4.9:1
  hairline:   '#E4D9CE',
  emberHi:    '#FF8A50',
  emberLo:    '#EB5A20',
} as const

type Fonts = { display: string; sans: string; numeral: string }

type Layout = {
  W: number; H: number
  padX: number; padTop: number; padBottom: number
  tile: number; wordmark: number
  name: number; nameGap: number
  hero: number; heroMin: number; unit: number; label: number
  stackGap: number
  chipFont: number; chipPadX: number; chipPadY: number
  tagline: number; url: number; footGap: number
}

/**
 * Every size in canvas pixels, per format. A square has barely half a story's
 * vertical room once the brand lockup and footer are paid for, so it is a
 * genuinely tighter scale rather than the story scale nudged down.
 */
function layoutFor(format: ShareFormat): Layout {
  return format === 'story'
    ? {
        W: 1080, H: 1920, padX: 86, padTop: 146, padBottom: 123,
        tile: 104, wordmark: 60,
        name: 40, nameGap: 34,
        hero: 254, heroMin: 120, unit: 93, label: 58,
        stackGap: 69,
        chipFont: 44, chipPadX: 50, chipPadY: 24,
        tagline: 54, url: 40, footGap: 19,
      }
    : {
        W: 1080, H: 1080, padX: 76, padTop: 70, padBottom: 65,
        tile: 84, wordmark: 44,
        name: 33, nameGap: 26,
        hero: 184, heroMin: 96, unit: 69, label: 46,
        stackGap: 35,
        chipFont: 36, chipPadX: 40, chipPadY: 19,
        tagline: 42, url: 33, footGap: 14,
      }
}

// lucide "flame" (24×24) — same glyph as the app icon and streak pill.
const FLAME_PATH =
  'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'

function drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, sizePx: number, color: string) {
  const p = new Path2D(FLAME_PATH)
  const s = sizePx / 24
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = 1.6
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.fill(p)
  ctx.stroke(p)
  ctx.restore()
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

type SpacingCtx = CanvasRenderingContext2D & { letterSpacing: string }

/**
 * `ctx.letterSpacing` is Chrome 99+ — Android Chrome and the TWA, which is
 * where these cards are actually made. Everywhere else it is silently ignored
 * and the text renders at normal tracking rather than breaking, which is the
 * right failure. Always restore: the value otherwise leaks into the next call.
 */
function withTracking(ctx: CanvasRenderingContext2D, value: string, draw: () => void) {
  const supported = 'letterSpacing' in ctx
  const prev = supported ? (ctx as SpacingCtx).letterSpacing : ''
  if (supported) (ctx as SpacingCtx).letterSpacing = value
  try {
    draw()
  } finally {
    if (supported) (ctx as SpacingCtx).letterSpacing = prev
  }
}

/** Shrink `text` until it fits `maxWidth`; returns the size that fit. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  spec: (size: number) => string,
  start: number,
  min: number,
  step = 2
): number {
  let size = start
  ctx.font = spec(size)
  while (ctx.measureText(text).width > maxWidth && size > min) {
    size -= step
    ctx.font = spec(size)
  }
  return size
}

/** Cut `text` to `maxWidth` with an ellipsis, for names that cannot shrink. */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let out = text
  while (out.length > 1 && ctx.measureText(out + '…').width > maxWidth) out = out.slice(0, -1)
  return out + '…'
}

/** The ground, the ember bloom behind the numeral, and the heat off the base. */
function paintGround(ctx: CanvasRenderingContext2D, L: Layout) {
  const g = ctx.createLinearGradient(0, 0, 0, L.H)
  g.addColorStop(0, PALETTE.groundTop)
  g.addColorStop(1, PALETTE.groundBot)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, L.W, L.H)

  const bx = L.W / 2
  const by = L.H * 0.46
  const br = L.W * 0.68
  const bloom = ctx.createRadialGradient(bx, by, 0, bx, by, br)
  bloom.addColorStop(0, 'rgba(255,138,80,.16)')
  bloom.addColorStop(0.62, 'rgba(241,102,46,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(0, 0, L.W, L.H)

  const heatTop = L.H * 0.58
  const heat = ctx.createLinearGradient(0, L.H, 0, heatTop)
  heat.addColorStop(0, 'rgba(241,102,46,.05)')
  heat.addColorStop(1, 'rgba(241,102,46,0)')
  ctx.fillStyle = heat
  ctx.fillRect(0, heatTop, L.W, L.H - heatTop)
}

/**
 * Film grain, procedurally.
 *
 * The design mockup used an SVG turbulence filter, which canvas has no
 * equivalent for — so a small noise tile is generated once and tiled. 128²
 * keeps it cheap; multiply keeps it from lifting the whites.
 */
function paintGrain(ctx: CanvasRenderingContext2D, L: Layout) {
  const TILE = 128
  const noise = document.createElement('canvas')
  noise.width = TILE
  noise.height = TILE
  const nctx = noise.getContext('2d')
  if (!nctx) return
  const img = nctx.createImageData(TILE, TILE)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 205 + Math.random() * 50
    img.data[i] = v
    img.data[i + 1] = v
    img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  nctx.putImageData(img, 0, 0)
  const pattern = ctx.createPattern(noise, 'repeat')
  if (!pattern) return
  ctx.save()
  ctx.globalAlpha = 0.2
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, L.W, L.H)
  ctx.restore()
}

/** Brand lockup, top-left: ember tile + flame + wordmark. Returns its bottom. */
function drawBrand(ctx: CanvasRenderingContext2D, L: Layout, fonts: Fonts): number {
  const x = L.padX
  const y = L.padTop
  const grad = ctx.createLinearGradient(x, y, x + L.tile * 0.35, y + L.tile)
  grad.addColorStop(0, PALETTE.emberHi)
  grad.addColorStop(1, PALETTE.emberLo)
  roundedRect(ctx, x, y, L.tile, L.tile, L.tile * 0.28)
  ctx.fillStyle = grad
  ctx.fill()
  drawFlame(ctx, x + L.tile * 0.2, y + L.tile * 0.2, L.tile * 0.6, '#FFF2E8')

  ctx.fillStyle = PALETTE.wordmark
  ctx.font = `700 ${L.wordmark}px ${fonts.display}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  withTracking(ctx, '-0.015em', () => {
    ctx.fillText('GetInShape', x + L.tile + 32, y + L.tile / 2 + 2)
  })
  return y + L.tile
}

/** Footer: the positioning line, then the URL. Returns its top edge. */
function drawFooter(ctx: CanvasRenderingContext2D, L: Layout, fonts: Fonts): number {
  const cx = L.W / 2
  const urlY = L.H - L.padBottom
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = PALETTE.url
  ctx.font = `500 ${L.url}px ${fonts.sans}`
  withTracking(ctx, '0.035em', () => ctx.fillText('getinshape.co.in', cx, urlY))

  const tagY = urlY - L.url - L.footGap
  ctx.fillStyle = PALETTE.tagline
  ctx.font = `700 ${L.tagline}px ${fonts.display}`
  withTracking(ctx, '-0.01em', () => ctx.fillText('Lose weight, not calories.', cx, tagY))

  return tagY - L.tagline
}

/** Outlined pill carrying the card's second true stat. */
function drawChip(
  ctx: CanvasRenderingContext2D,
  L: Layout,
  fonts: Fonts,
  text: string,
  centerY: number
): number {
  ctx.font = `600 ${L.chipFont}px ${fonts.sans}`
  const dot = L.chipFont * 0.4
  const gap = L.chipFont * 0.5
  const textW = ctx.measureText(text).width
  const w = textW + dot + gap + L.chipPadX * 2
  const h = L.chipFont + L.chipPadY * 2
  const x = (L.W - w) / 2
  const y = centerY - h / 2

  roundedRect(ctx, x, y, w, h, h / 2)
  ctx.fillStyle = PALETTE.chipFill
  ctx.fill()
  ctx.strokeStyle = PALETTE.chipBorder
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x + L.chipPadX + dot / 2, centerY, dot / 2, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.dot
  ctx.fill()

  ctx.fillStyle = PALETTE.chipText
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + L.chipPadX + dot + gap, centerY + 1)
  return h
}

/* ------------------------------------------------------------------ *
 * The numeral face
 * ------------------------------------------------------------------ */

const NUMERAL_TIMEOUT_MS = 1500

/**
 * Every glyph the numeral face is ever asked to draw.
 *
 * Passed to `document.fonts.load` so the browser fetches only the subset that
 * covers them. next/font splits Instrument Serif into latin (15 KB) and
 * latin-ext (8 KB); without this argument both are candidates, and the card
 * would pay for an extended subset it never renders a glyph from.
 */
const NUMERAL_GLYPHS = '0123456789.,'

/**
 * Instrument Serif, loaded on demand.
 *
 * Canvas does NOT trigger a font download by setting `ctx.font` — an unloaded
 * family silently falls back, which is exactly how a card ships looking nothing
 * like its design review. So the face is requested explicitly, and only when
 * someone opens a share sheet: `app/layout.tsx` registers it with
 * `preload: false` and nothing in the DOM uses it, so a user who never shares
 * pays zero bytes.
 *
 * Returns the family to use, or null on timeout/failure — and the caller then
 * sets the hero in Inter Tight, which is why that fallback has to look
 * deliberate rather than merely acceptable.
 */
export async function ensureNumeralFont(numeralStack: string): Promise<string | null> {
  if (typeof document === 'undefined' || !document.fonts) return null
  const family = numeralStack.split(',')[0].trim().replace(/^["']|["']$/g, '')
  if (!family) return null
  const spec = `400 100px "${family}"`
  try {
    if (document.fonts.check(spec, NUMERAL_GLYPHS)) return family
    await Promise.race([
      document.fonts.load(spec, NUMERAL_GLYPHS),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('numeral font timeout')), NUMERAL_TIMEOUT_MS)
      ),
    ])
    return document.fonts.check(spec, NUMERAL_GLYPHS) ? family : null
  } catch {
    return null
  }
}

export type DrawOptions = {
  format?: ShareFormat
  /** First name for the byline. Absent for anonymous accounts. */
  firstName?: string | null
  /** Resolved by the share helpers; null means fall back to Inter Tight. */
  numeralFamily?: string | null
}

/**
 * The stat card: a name, one number, and the promise.
 *
 * The thali plate was removed deliberately. On a light ground it needed a rim
 * dark enough to read as steel, which fought the numeral for attention, and at
 * status size — about 360px tall — the macro katoris were unreadable dots. The
 * number is the whole card now.
 */
export function drawShareCard(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
  fonts: Fonts,
  opts: DrawOptions = {}
): void {
  const L = layoutFor(opts.format ?? 'square')
  canvas.width = L.W
  canvas.height = L.H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D not supported')

  paintGround(ctx, L)
  const brandBottom = drawBrand(ctx, L, fonts)
  const footTop = drawFooter(ctx, L, fonts)

  const cx = L.W / 2
  const maxW = L.W - L.padX * 2
  const serif = opts.numeralFamily
  const heroSpec = (size: number) =>
    serif ? `400 ${size}px "${serif}", Georgia, serif` : `800 ${size}px ${fonts.display}`

  // Measure the whole stack before drawing any of it, so it can be centred in
  // the space the brand lockup and footer leave behind. The byline is simply
  // absent for an anonymous account, and because everything is measured rather
  // than positioned by fixed offsets, its absence closes up instead of leaving
  // a hole.
  const name = opts.firstName ? opts.firstName.trim() : ''
  const heroSize = fitFont(ctx, data.hero.value, maxW * 0.92, heroSpec, L.hero, L.heroMin, 6)
  ctx.font = heroSpec(heroSize)
  const heroM = ctx.measureText(data.hero.value)
  const heroW = heroM.width
  const heroAscent = heroM.actualBoundingBoxAscent || heroSize * 0.72
  const heroDescent = heroM.actualBoundingBoxDescent || heroSize * 0.1

  const labelSize = fitFont(
    ctx, data.hero.label, maxW,
    (s) => `500 ${s}px ${fonts.sans}`, L.label, Math.round(L.label * 0.6)
  )

  const nameBlock = name ? L.name * 1.2 + L.nameGap : 0
  const chipH = data.subline ? L.chipFont + L.chipPadY * 2 : 0
  const chipBlock = data.subline ? chipH + L.stackGap : 0
  const stackH = nameBlock + heroAscent + heroDescent + labelSize * 1.5 + chipBlock

  let y = Math.max(brandBottom + L.padTop * 0.35, (brandBottom + footTop) / 2 - stackH / 2)

  // Byline — uppercase, widely tracked, in the accent. It claims the
  // achievement without competing with it.
  if (name) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = PALETTE.name
    ctx.font = `700 ${L.name}px ${fonts.sans}`
    withTracking(ctx, '0.17em', () => {
      // Tracking adds space after the final glyph, pushing the optical centre
      // left; nudge back by roughly half a step so the line sits centred.
      ctx.fillText(ellipsize(ctx, name.toUpperCase(), maxW), cx + L.name * 0.085, y + L.name)
    })
    y += nameBlock
  }

  // Hero numeral + unit, baseline-aligned. Two faces, two weights and two
  // colours, so the figure reads as composed rather than as one flat string.
  const unitText = data.hero.unit ?? ''
  ctx.font = `600 ${L.unit}px ${fonts.display}`
  const unitGap = unitText ? L.unit * 0.14 : 0
  const unitW = unitText ? ctx.measureText(unitText).width : 0

  const startX = cx - (heroW + unitGap + unitW) / 2
  const baseline = y + heroAscent

  ctx.font = heroSpec(heroSize)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = PALETTE.magInk
  withTracking(ctx, serif ? '-0.012em' : '-0.045em', () => {
    ctx.fillText(data.hero.value, startX, baseline)
  })

  if (unitText) {
    ctx.font = `600 ${L.unit}px ${fonts.display}`
    ctx.fillStyle = PALETTE.unit
    withTracking(ctx, '-0.02em', () => {
      ctx.fillText(unitText, startX + heroW + unitGap, baseline)
    })
  }
  y = baseline + heroDescent

  ctx.textAlign = 'center'
  ctx.fillStyle = PALETTE.label
  ctx.font = `500 ${labelSize}px ${fonts.sans}`
  ctx.fillText(data.hero.label, cx, y + labelSize)
  y += labelSize * 1.5

  if (data.subline) {
    y += L.stackGap
    ctx.font = `600 ${L.chipFont}px ${fonts.sans}`
    const chipText = ellipsize(ctx, data.subline, maxW - L.chipPadX * 2 - L.chipFont * 1.4)
    drawChip(ctx, L, fonts, chipText, y + chipH / 2)
  }

  paintGrain(ctx, L)
}

/**
 * The day card: the day's total, then the meals as a menu.
 *
 * Same world as the stat card — same ground, same brand lockup, same footer —
 * but a menu rather than a numeral, because that is what a day actually is. The
 * whole block is measured first and then centred, so a one-meal day doesn't
 * float at the top of a mostly empty card.
 */
export function drawDayCard(
  canvas: HTMLCanvasElement,
  data: DayCardData,
  fonts: Fonts,
  opts: DrawOptions = {}
): void {
  const L = layoutFor(opts.format ?? 'story')
  canvas.width = L.W
  canvas.height = L.H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D not supported')

  paintGround(ctx, L)
  const brandBottom = drawBrand(ctx, L, fonts)
  const footTop = drawFooter(ctx, L, fonts)

  const cx = L.W / 2
  const story = L.H === 1920
  const serif = opts.numeralFamily
  const name = opts.firstName ? opts.firstName.trim() : ''

  const contentTop = brandBottom + L.padTop * 0.35
  const contentBottom = footTop - (story ? 40 : 26)

  const base = {
    nameH: name ? L.name * 1.2 + L.nameGap * 0.6 : 0,
    dateH: story ? 66 : 52,
    totalH: story ? 190 : 132,
    totalGap: story ? 44 : 30,
    mealHeadH: story ? 62 : 48,
    itemH: story ? 56 : 44,
    mealGapH: story ? 26 : 18,
    macroH: data.macroLine ? (story ? 70 : 54) : 0,
  }
  const measure = (m: typeof base) =>
    m.nameH + m.dateH + m.totalH + m.totalGap + m.macroH +
    data.meals.reduce(
      (s, meal) =>
        s + m.mealHeadH + meal.items.length * m.itemH +
        (meal.hiddenItems > 0 ? m.itemH : 0) + m.mealGapH,
      0
    )

  // Squeeze to fit rather than run into the footer. MAX_ITEM_LINES keeps `k`
  // near 1 in practice; this is the backstop, because a menu overlapping the
  // footer is a broken card the user only discovers after posting it.
  const k = Math.max(0.68, Math.min(1, (contentBottom - contentTop) / measure(base)))
  const f = (n: number) => Math.max(15, Math.round(n * k))
  const nameH = base.nameH * k
  const dateH = base.dateH * k
  const totalGap = base.totalGap * k
  const mealHeadH = base.mealHeadH * k
  const itemH = base.itemH * k
  const mealGapH = base.mealGapH * k
  const macroH = base.macroH * k

  const totalStr = formatKcal(data.totalKcal)
  const totalSpec = (size: number) =>
    serif ? `400 ${size}px "${serif}", Georgia, serif` : `800 ${size}px ${fonts.display}`
  const totalSize = fitFont(
    ctx, totalStr, (L.W - L.padX * 2) * 0.6, totalSpec, f(base.totalH), f(70), 4
  )
  ctx.font = totalSpec(totalSize)
  const totalM = ctx.measureText(totalStr)
  const totalAsc = totalM.actualBoundingBoxAscent || totalSize * 0.72
  const totalDesc = totalM.actualBoundingBoxDescent || totalSize * 0.1

  const blockH = measure({ ...base, nameH, dateH, totalH: totalAsc + totalDesc, totalGap,
    mealHeadH, itemH, mealGapH, macroH })
  let y = Math.max(contentTop, (contentTop + contentBottom) / 2 - blockH / 2)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  if (name) {
    ctx.fillStyle = PALETTE.name
    ctx.font = `700 ${f(L.name)}px ${fonts.sans}`
    withTracking(ctx, '0.17em', () => {
      ctx.fillText(name.toUpperCase(), cx + L.name * 0.085, y + f(L.name))
    })
    y += nameH
  }

  ctx.fillStyle = PALETTE.label
  const dateSize = fitFont(
    ctx, data.dateLabel, L.W - L.padX * 2,
    (s) => `500 ${s}px ${fonts.sans}`, f(story ? 44 : 34), 20
  )
  ctx.font = `500 ${dateSize}px ${fonts.sans}`
  ctx.fillText(data.dateLabel, cx, y + dateSize)
  y += dateH

  // The day's total, with its unit alongside — same lockup as the stat card.
  ctx.font = `600 ${f(L.unit * 0.62)}px ${fonts.display}`
  const kcalW = ctx.measureText('kcal').width
  const kcalGap = f(L.unit * 0.12)
  const startX = cx - (totalM.width + kcalGap + kcalW) / 2
  const totalBaseline = y + totalAsc

  ctx.font = totalSpec(totalSize)
  ctx.textAlign = 'left'
  ctx.fillStyle = PALETTE.magInk
  withTracking(ctx, serif ? '-0.012em' : '-0.045em', () => {
    ctx.fillText(totalStr, startX, totalBaseline)
  })
  ctx.font = `600 ${f(L.unit * 0.62)}px ${fonts.display}`
  ctx.fillStyle = PALETTE.unit
  ctx.fillText('kcal', startX + totalM.width + kcalGap, totalBaseline)

  y = totalBaseline + totalDesc + totalGap

  // The menu
  const padX = L.padX
  const kcalX = L.W - padX
  const nameMax = L.W - padX * 2 - f(story ? 190 : 150)

  for (const meal of data.meals) {
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = PALETTE.wordmark
    ctx.font = `700 ${f(story ? 40 : 32)}px ${fonts.sans}`
    ctx.fillText(meal.label, padX, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = PALETTE.unit
    ctx.font = `700 ${f(story ? 36 : 29)}px ${fonts.sans}`
    ctx.fillText(`${formatKcal(meal.kcal)} kcal`, kcalX, y)
    y += mealHeadH * 0.4

    ctx.strokeStyle = PALETTE.hairline
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(padX, y)
    ctx.lineTo(kcalX, y)
    ctx.stroke()
    y += mealHeadH * 0.6

    for (const item of meal.items) {
      ctx.textAlign = 'left'
      ctx.fillStyle = PALETTE.label
      ctx.font = `500 ${f(story ? 34 : 27)}px ${fonts.sans}`
      ctx.fillText(ellipsize(ctx, item.name, nameMax), padX, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = PALETTE.url
      ctx.font = `500 ${f(story ? 32 : 26)}px ${fonts.sans}`
      ctx.fillText(String(item.kcal), kcalX, y)
      y += itemH
    }

    // Never silently truncate a menu — say what was left off.
    if (meal.hiddenItems > 0) {
      ctx.textAlign = 'left'
      ctx.fillStyle = PALETTE.url
      ctx.font = `500 italic ${f(story ? 30 : 24)}px ${fonts.sans}`
      ctx.fillText(`+${meal.hiddenItems} more`, padX, y)
      y += itemH
    }
    y += mealGapH
  }

  if (data.macroLine) {
    ctx.textAlign = 'center'
    ctx.fillStyle = PALETTE.url
    const mSize = fitFont(
      ctx, data.macroLine, L.W - L.padX * 2,
      (s) => `600 ${s}px ${fonts.sans}`, f(story ? 34 : 28), 18
    )
    ctx.font = `600 ${mSize}px ${fonts.sans}`
    ctx.fillText(data.macroLine, cx, y + macroH * 0.45)
  }

  paintGrain(ctx, L)
}

/** Resolve the app's real font stacks so the card matches the UI type. */
export function resolveFonts(): Fonts {
  const root = getComputedStyle(document.documentElement)
  return {
    display: root.getPropertyValue('--font-display').trim() || 'Inter Tight, sans-serif',
    sans: root.getPropertyValue('--font-sans').trim() || 'Inter, sans-serif',
    numeral: root.getPropertyValue('--font-numeral').trim() || 'Instrument Serif, Georgia, serif',
  }
}

async function deliver(canvas: HTMLCanvasElement, name: string): Promise<'shared' | 'downloaded'> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not render the card')

  const file = new File([blob], name, { type: 'image/png' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'My GetInShape progress',
        text: 'Lose weight, not calories. getinshape.co.in',
      })
      return 'shared'
    } catch (err) {
      // AbortError = user closed the sheet — treat as done, don't force a download.
      if ((err as Error).name === 'AbortError') return 'shared'
      // Anything else: fall through to download.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}

/**
 * Render + share the stat card. Returns how it was delivered: 'shared' via the
 * Web Share API sheet, 'downloaded' as a PNG fallback (desktop browsers).
 */
export async function shareProgressCard(
  data: ShareCardData,
  opts: DrawOptions = {}
): Promise<'shared' | 'downloaded'> {
  const format = opts.format ?? 'square'
  const fonts = resolveFonts()
  const numeralFamily = await ensureNumeralFont(fonts.numeral)
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  drawShareCard(canvas, data, fonts, { ...opts, numeralFamily })
  return deliver(canvas, `getinshape-progress-${format}.png`)
}

/** Render + share the day card. */
export async function shareDayCard(
  data: DayCardData,
  opts: DrawOptions = {}
): Promise<'shared' | 'downloaded'> {
  const format = opts.format ?? 'story'
  const fonts = resolveFonts()
  const numeralFamily = await ensureNumeralFont(fonts.numeral)
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  drawDayCard(canvas, data, fonts, { ...opts, numeralFamily })
  return deliver(canvas, `getinshape-day-${format}.png`)
}

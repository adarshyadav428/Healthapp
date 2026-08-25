/**
 * Share cards — brand images rendered client-side to a canvas and handed to the
 * Web Share API (WhatsApp/Instagram on Android) with a download fallback.
 *
 * Two cards:
 *  - the **stat card** (weight lost, streak, deficit) — one number on a thali
 *  - the **day card** — a day's meals as a menu, under the day's total
 *
 * Two formats each: `square` (1080×1080) for a feed post or a chat, and `story`
 * (1080×1920) for WhatsApp status and Instagram stories — a square posted to a
 * story floats in a grey box, which is where most of these actually go.
 *
 * Data prep is pure (tested); drawing takes the prepared data. The palette is
 * intentionally fixed to a light look — a share card is a brand asset and must
 * render identically for dark-theme users, which is why these hex values live
 * here (lib/ is outside the check-tokens scan) and not in a component. They are
 * Kelp-derived but NOT a copy of :root: the app's ground (#F2F5F4) sits a
 * fraction under white, which on a card left the plate invisible against it.
 * See PALETTE.
 */

export type ShareCardData = {
  hero: { value: string; label: string }
  /** Already carries its own leading glyph, if any — the drawing adds none. */
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
          hero: { value: `${kg.toFixed(1)} kg`, label: `down ${sinceLabel}` },
          subline: streakDays >= 1 ? `${streakDays} day logging streak` : null,
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
          hero: { value: String(streakDays), label: 'day streak' },
          subline: hasLoss ? `▼ ${(kgLost as number).toFixed(1)} kg down ${sinceLabel}` : null,
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
          hero: { value: formatKcal(deficit.kcal), label: 'kcal under maintenance' },
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
  emoji: string
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

const MEAL_ORDER: { slot: DayCardMealSlot; label: string; emoji: string }[] = [
  { slot: 'breakfast', label: 'Breakfast', emoji: '🥣' },
  { slot: 'lunch', label: 'Lunch', emoji: '🍛' },
  { slot: 'dinner', label: 'Dinner', emoji: '🍲' },
  { slot: 'snack', label: 'Snack', emoji: '🥜' },
]

/**
 * A card can only hold so many lines before the menu runs into the footer band.
 * Past the budget the longest meals give up their last items, and the card says
 * so rather than silently truncating — a menu missing a dish with no
 * acknowledgement is a lie about what someone ate.
 *
 * A square has roughly half the vertical room of a story once the plate and the
 * band are paid for, hence two budgets rather than one.
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
  for (const { slot, label, emoji } of MEAL_ORDER) {
    const rows = logs.filter((l) => l.meal === slot)
    if (rows.length === 0) continue
    meals.push({
      slot,
      label,
      emoji,
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
 * Kelp-derived, but the ground is deliberately darker than the app's `--canvas`.
 *
 * The first version copied `:root` exactly, which put a #FFFFFF plate on a
 * #F2F5F4 ground — 1.03:1, so the thali read as a faint blob rather than a
 * plate, and the whole card looked unfinished. The ground is now a soft sage
 * and the rim is a real steel that clears 3:1 against it, so the plate is a
 * drawn object. Subline green is `--brand-text`, not `--brand`: at 4.29:1 the
 * lighter one missed 4.5 on this ground.
 */
const PALETTE = {
  canvas: '#E3EDEA',
  surface: '#FFFFFF',
  ink: '#0E1413',
  ink2: '#4E5856',
  ink3: '#66716F',
  good: '#0A5F4E',
  // --accent-hi → --accent-lo, the same pair --ava-grad uses.
  gradFrom: '#16A085',
  gradTo: '#0A5F4E',
  // The steel of the thali. `rimOuter` is the drawn edge and carries the
  // contrast (3.4:1 on canvas); `rimInner` is the flat of the rim.
  rimOuter: '#6E837E',
  rimInner: '#C9D8D4',
  hairline: '#C6D5D0',
}

/** 1080×1080 for a post or a chat; 1080×1920 for status and stories. */
export type ShareFormat = 'square' | 'story'

type Layout = {
  W: number
  H: number
  brandY: number
  tile: number
  wordmark: number
  cy: number
  rOuter: number
  rInner: number
  sublineY: number
  bandH: number
}

/**
 * Where everything sits, per format. One table rather than two draw functions:
 * the story card must stay the *same* card, or the two drift the first time one
 * is fixed. Width is 1080 in both, so only the vertical rhythm and the plate
 * scale change; everything inside the plate is a fraction of `rInner`.
 */
function layoutFor(format: ShareFormat): Layout {
  return format === 'story'
    ? { W: 1080, H: 1920, brandY: 150, tile: 104, wordmark: 60, cy: 900, rOuter: 424, rInner: 352, sublineY: 1560, bandH: 150 }
    : { W: 1080, H: 1080, brandY: 72, tile: 88, wordmark: 52, cy: 520, rOuter: 330, rInner: 274, sublineY: 905, bandH: 110 }
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
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Brand lockup, top-left: mini icon tile + wordmark. Shared by both cards. */
function drawBrand(ctx: CanvasRenderingContext2D, L: Layout, fonts: Fonts) {
  const grad = ctx.createLinearGradient(72, L.brandY, 72 + L.tile * 0.35, L.brandY + L.tile)
  grad.addColorStop(0, PALETTE.gradFrom)
  grad.addColorStop(1, PALETTE.gradTo)
  roundedRect(ctx, 72, L.brandY, L.tile, L.tile, L.tile * 0.27)
  ctx.fillStyle = grad
  ctx.fill()
  drawFlame(ctx, 72 + L.tile * 0.2, L.brandY + L.tile * 0.2, L.tile * 0.6, '#FFFFFF')
  ctx.fillStyle = PALETTE.ink
  ctx.font = `700 ${L.wordmark}px ${fonts.display}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText('GetInShape', 72 + L.tile + 32, L.brandY + L.tile / 2 + 2)
}

/** Footer band — accent gradient with the site URL. Shared by both cards. */
function drawFooter(ctx: CanvasRenderingContext2D, L: Layout, fonts: Fonts) {
  const bandGrad = ctx.createLinearGradient(0, L.H - L.bandH, L.W * 0.4, L.H)
  bandGrad.addColorStop(0, PALETTE.gradFrom)
  bandGrad.addColorStop(1, PALETTE.gradTo)
  ctx.fillStyle = bandGrad
  ctx.fillRect(0, L.H - L.bandH, L.W, L.bandH)
  ctx.textAlign = 'center'
  ctx.font = `600 38px ${fonts.sans}`
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText('getinshape.co.in · Indian Calorie Tracker', L.W / 2, L.H - L.bandH / 2 + 2)
}

/**
 * The thali: a round steel plate, drawn with a soft drop shadow so it sits on
 * the ground rather than being a hole in it.
 *
 * Not a rectangle with a number in it. Every tracker in the category ships the
 * rectangle; nobody owns the thali, it reads as Indian instantly, and being a
 * *shape* rather than a colour it survives being screenshotted onto any
 * background.
 */
function drawPlate(ctx: CanvasRenderingContext2D, cx: number, cy: number, rOuter: number, rInner: number) {
  ctx.save()
  ctx.shadowColor = 'rgba(14,20,19,.18)'
  ctx.shadowBlur = rOuter * 0.12
  ctx.shadowOffsetY = rOuter * 0.045
  ctx.beginPath()
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.rimOuter
  ctx.fill()
  ctx.restore()

  ctx.beginPath()
  ctx.arc(cx, cy, rOuter - Math.max(6, rOuter * 0.035), 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.rimInner
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.surface
  ctx.fill()
}

type Fonts = { display: string; sans: string }

/**
 * Shrink `text` until it fits `maxWidth`, and return the size that fit.
 *
 * Every string on these cards goes through this. Audit finding P2-5 was a hero
 * that overran the plate; the failure mode is a permanently broken card and
 * there is no way to notice it before a user posts one.
 */
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

export type DrawOptions = { format?: ShareFormat }

/**
 * The stat card: one number on the plate.
 *
 * The macro katoris were removed deliberately — at status size, read about
 * 360px tall, a "C 62%" label is unreadable, and three bowls crowding the rim
 * collided with the label under the hero. The plate is the hero now.
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

  ctx.fillStyle = PALETTE.canvas
  ctx.fillRect(0, 0, L.W, L.H)
  drawBrand(ctx, L, fonts)

  const cx = L.W / 2
  drawPlate(ctx, cx, L.cy, L.rOuter, L.rInner)
  ctx.textAlign = 'center'

  // The flame sits above the number, where the katoris used to be crowding it.
  drawFlame(ctx, cx - L.rInner * 0.125, L.cy - L.rInner * 0.62, L.rInner * 0.25, PALETTE.gradTo)

  ctx.fillStyle = PALETTE.ink
  const heroSize = fitFont(
    ctx, data.hero.value, L.rInner * 1.52,
    (s) => `700 ${s}px ${fonts.display}`,
    Math.round(L.rInner * 0.78), Math.round(L.rInner * 0.34), 8
  )
  ctx.font = `700 ${heroSize}px ${fonts.display}`
  ctx.fillText(data.hero.value, cx, L.cy + L.rInner * 0.06)

  // The label is a sentence fragment now ("kcal under maintenance"), not one
  // word, so it gets the same clamp — it overruns the rim before the hero does.
  const labelSize = fitFont(
    ctx, data.hero.label, L.rInner * 1.62,
    (s) => `600 ${s}px ${fonts.sans}`,
    Math.round(L.rInner * 0.155), 22
  )
  ctx.font = `600 ${labelSize}px ${fonts.sans}`
  ctx.fillStyle = PALETTE.ink2
  ctx.fillText(data.hero.label, cx, L.cy + L.rInner * 0.44)

  if (data.subline) {
    const subSize = fitFont(
      ctx, data.subline, L.W - 130,
      (s) => `600 ${s}px ${fonts.sans}`, 46, 28
    )
    ctx.font = `600 ${subSize}px ${fonts.sans}`
    ctx.fillStyle = PALETTE.good
    ctx.fillText(data.subline, cx, L.sublineY)
  }

  drawFooter(ctx, L, fonts)
}

/**
 * The day card: the day's total on a small plate, then the meals as a menu.
 *
 * The plate shrinks here on purpose — it is the signature, but the menu is the
 * content, and a menu is the one thing that fills a 9:16 frame honestly. The
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

  ctx.fillStyle = PALETTE.canvas
  ctx.fillRect(0, 0, L.W, L.H)
  drawBrand(ctx, L, fonts)

  const cx = L.W / 2
  const story = L.H === 1920

  // Vertical metrics, measured before anything is drawn so the block can be
  // centred in the space between the brand lockup and the footer band — and, if
  // the day is a long one, squeezed to fit rather than run into the band. The
  // line budget (MAX_ITEM_LINES) keeps `k` near 1 in practice; this is the
  // backstop, because a menu overlapping the footer is a broken card and the
  // user only finds out after posting it.
  const gapTop = story ? 70 : 40
  const contentTop = L.brandY + L.tile + gapTop
  const contentBottom = L.H - L.bandH - (story ? 60 : 40)

  const base = {
    plateR: story ? 210 : 150,
    mealHeadH: story ? 62 : 48,
    itemH: story ? 56 : 44,
    mealGapH: story ? 26 : 18,
    dateH: story ? 64 : 52,
    macroH: data.macroLine ? (story ? 70 : 56) : 0,
    plateGap: 34,
  }
  const measure = (m: typeof base) =>
    m.dateH + m.plateR * 2 + m.plateGap + m.macroH +
    data.meals.reduce(
      (s, meal) =>
        s + m.mealHeadH + meal.items.length * m.itemH + (meal.hiddenItems > 0 ? m.itemH : 0) + m.mealGapH,
      0
    )

  // Floored so a pathological day shrinks to unreadable rather than never.
  const k = Math.max(0.7, Math.min(1, (contentBottom - contentTop) / measure(base)))
  const plateR = base.plateR * k
  const plateInner = plateR * 0.82
  const mealHeadH = base.mealHeadH * k
  const itemH = base.itemH * k
  const mealGapH = base.mealGapH * k
  const dateH = base.dateH * k
  const macroH = base.macroH * k
  const blockH = measure({ ...base, plateR, mealHeadH, itemH, mealGapH, dateH, macroH, plateGap: base.plateGap * k })

  // Type scales with the metrics, or a squeezed card keeps full-size text in
  // half-size rows.
  const f = (n: number) => Math.max(16, Math.round(n * k))

  let y = Math.max(contentTop, (contentTop + contentBottom) / 2 - blockH / 2)

  // Date
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = PALETTE.ink3
  const dateSize = fitFont(ctx, data.dateLabel, L.W - 160, (s) => `600 ${s}px ${fonts.sans}`, f(story ? 42 : 34), 22)
  ctx.font = `600 ${dateSize}px ${fonts.sans}`
  ctx.fillText(data.dateLabel, cx, y)
  y += dateH

  // The day's total, on the plate
  const pcy = y + plateR
  drawPlate(ctx, cx, pcy, plateR, plateInner)
  ctx.fillStyle = PALETTE.ink
  const totalStr = formatKcal(data.totalKcal)
  const totalSize = fitFont(
    ctx, totalStr, plateInner * 1.5,
    (s) => `700 ${s}px ${fonts.display}`,
    Math.round(plateInner * 0.7), Math.round(plateInner * 0.34), 4
  )
  ctx.font = `700 ${totalSize}px ${fonts.display}`
  ctx.fillText(totalStr, cx, pcy - plateInner * 0.1)
  ctx.fillStyle = PALETTE.ink2
  ctx.font = `600 ${Math.round(plateInner * 0.2)}px ${fonts.sans}`
  ctx.fillText('kcal', cx, pcy + plateInner * 0.42)
  y = pcy + plateR + base.plateGap * k

  // The menu
  const padX = story ? 96 : 76
  const kcalX = L.W - padX
  const nameMax = L.W - padX * 2 - (story ? 200 : 160)

  for (const meal of data.meals) {
    // Meal heading: emoji + label on the left, that meal's kcal on the right
    ctx.textAlign = 'left'
    ctx.fillStyle = PALETTE.ink
    ctx.font = `700 ${f(story ? 40 : 32)}px ${fonts.sans}`
    ctx.fillText(`${meal.emoji}  ${meal.label}`, padX, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = PALETTE.good
    ctx.font = `700 ${f(story ? 38 : 30)}px ${fonts.sans}`
    ctx.fillText(`${formatKcal(meal.kcal)} kcal`, kcalX, y)
    y += mealHeadH * 0.42

    ctx.strokeStyle = PALETTE.hairline
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(padX, y)
    ctx.lineTo(kcalX, y)
    ctx.stroke()
    y += mealHeadH * 0.58

    for (const item of meal.items) {
      ctx.textAlign = 'left'
      ctx.fillStyle = PALETTE.ink2
      ctx.font = `500 ${f(story ? 34 : 27)}px ${fonts.sans}`
      ctx.fillText(ellipsize(ctx, item.name, nameMax), padX, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = PALETTE.ink3
      ctx.font = `500 ${f(story ? 32 : 26)}px ${fonts.sans}`
      ctx.fillText(String(item.kcal), kcalX, y)
      y += itemH
    }

    // Never silently truncate a menu — say what was left off.
    if (meal.hiddenItems > 0) {
      ctx.textAlign = 'left'
      ctx.fillStyle = PALETTE.ink3
      ctx.font = `500 italic ${f(story ? 30 : 24)}px ${fonts.sans}`
      ctx.fillText(`+${meal.hiddenItems} more`, padX, y)
      y += itemH
    }

    y += mealGapH
  }

  if (data.macroLine) {
    ctx.textAlign = 'center'
    ctx.fillStyle = PALETTE.ink3
    const mSize = fitFont(ctx, data.macroLine, L.W - 160, (s) => `600 ${s}px ${fonts.sans}`, f(story ? 36 : 29), 20)
    ctx.font = `600 ${mSize}px ${fonts.sans}`
    ctx.fillText(data.macroLine, cx, y + macroH * 0.4)
  }

  drawFooter(ctx, L, fonts)
}

/** Resolve the app's real font stacks so the card matches the UI type. */
export function resolveFonts(): Fonts {
  const root = getComputedStyle(document.documentElement)
  return {
    display: root.getPropertyValue('--font-display').trim() || 'Inter Tight, sans-serif',
    sans: root.getPropertyValue('--font-sans').trim() || 'Inter, sans-serif',
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
        text: 'Tracking my food and weight with GetInShape 🔥 getinshape.co.in',
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
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  drawShareCard(canvas, data, resolveFonts(), opts)
  return deliver(canvas, `getinshape-progress-${format}.png`)
}

/** Render + share the day card. */
export async function shareDayCard(
  data: DayCardData,
  opts: DrawOptions = {}
): Promise<'shared' | 'downloaded'> {
  const format = opts.format ?? 'story'
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  drawDayCard(canvas, data, resolveFonts(), opts)
  return deliver(canvas, `getinshape-day-${format}.png`)
}

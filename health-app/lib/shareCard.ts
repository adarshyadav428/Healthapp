/**
 * Share progress card — a brand image (weight lost, streak or deficit) rendered
 * client-side to a canvas and handed to the Web Share API (WhatsApp/Instagram
 * on Android) with a download fallback.
 *
 * Two formats: `square` (1080×1080) for a feed post or a chat, and `story`
 * (1080×1920) for WhatsApp status and Instagram stories — a square posted to a
 * story floats in a grey box, which is the surface most of these actually go to.
 * Both are the same art with different vertical air, not two cards to maintain.
 *
 * Data prep is pure (tested); drawing takes the prepared data. The palette is
 * intentionally fixed to the Kelp "Shore" light look — a share card is a brand
 * asset and must render identically for dark-theme users, which is why these
 * hex values live here (lib/ is outside the check-tokens scan) and not in a
 * component. Values mirror :root in app/globals.css.
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

// Kelp "Shore" palette (see note above). Macro hues mirror --protein/--carbs/
// --fat in :root; like everything else here they're pinned to the light theme
// so the exported image never depends on the viewer's.
const PALETTE = {
  canvas: '#F2F5F4',
  surface: '#FFFFFF',
  ink: '#0E1413',
  ink2: '#4E5856',
  ink3: '#66716F',
  good: '#0E7C66',
  // --accent-hi → --accent-lo, the same pair --ava-grad uses. The primary CTA
  // is flat in Kelp, but a brand mark still carries the gradient.
  gradFrom: '#16A085',
  gradTo: '#0A5F4E',
  protein: '#4459C6',
  carbs: '#9A6714',
  fat: '#A8433A',
  // Steel rim of the thali — cool greys, so it sits in the Kelp world rather
  // than looking like a stray UI chrome element.
  rimOuter: '#D3DCDA',
  rimInner: '#E9EFED',
}

/**
 * The macro split of the plate, as fractions that sum to 1.
 *
 * Separate from ShareCardData on purpose: the hero is what the card is *about*,
 * while the plate is decoration that happens to be truthful. Callers without
 * macro data still get a thali, just without the katoris.
 */
export type PlateSplit = { protein: number; carbs: number; fat: number }

/**
 * Normalise grams into fractions of the plate.
 *
 * Uses raw grams rather than calories deliberately — the katoris are read as
 * "how much of this did I eat", and nobody pictures a spoon of oil as being
 * bigger than a bowl of rice. Returns null when there's nothing to divide, so
 * the caller draws the plain plate instead of three empty bowls.
 */
export function buildPlateSplit(
  macros?: { proteinG: number; carbsG: number; fatG: number } | null
): PlateSplit | null {
  if (!macros) return null
  const p = Math.max(0, macros.proteinG || 0)
  const c = Math.max(0, macros.carbsG || 0)
  const f = Math.max(0, macros.fatG || 0)
  const total = p + c + f
  if (total <= 0) return null
  return { protein: p / total, carbs: c / total, fat: f / total }
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
 * scale change; everything inside the plate is expressed as a fraction of
 * `rInner` so it scales with it.
 */
function layoutFor(format: ShareFormat): Layout {
  return format === 'story'
    ? { W: 1080, H: 1920, brandY: 150, tile: 104, wordmark: 60, cy: 940, rOuter: 400, rInner: 332, sublineY: 1580, bandH: 150 }
    : { W: 1080, H: 1080, brandY: 72, tile: 88, wordmark: 52, cy: 540, rOuter: 330, rInner: 274, sublineY: 940, bandH: 110 }
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

/** A katori: rim ring, then a bottom-up fill showing that macro's share. */
function drawKatori(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fraction: number,
  color: string
) {
  // Bowl
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.rimInner
  ctx.fill()

  // Contents — clipped to the bowl and filled from the bottom, so the katori
  // reads as "this full" at a glance rather than as a pie chart.
  const h = Math.max(0, Math.min(1, fraction)) * (r * 2)
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = color
  ctx.fillRect(cx - r, cy + r - h, r * 2, h)
  ctx.restore()

  // Rim
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = PALETTE.rimOuter
  ctx.lineWidth = 6
  ctx.stroke()
}

export type DrawOptions = {
  plate?: PlateSplit | null
  format?: ShareFormat
}

export function drawShareCard(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
  fonts: { display: string; sans: string },
  opts: DrawOptions = {}
): void {
  const { plate, format = 'square' } = opts
  const L = layoutFor(format)
  canvas.width = L.W
  canvas.height = L.H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D not supported')

  // Canvas background
  ctx.fillStyle = PALETTE.canvas
  ctx.fillRect(0, 0, L.W, L.H)

  // Brand lockup, top-left: mini icon tile + wordmark
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

  // ── The thali ───────────────────────────────────────────────────────────
  // A round steel plate, not a rectangle with a number in it. Every tracker
  // in the category ships the rectangle; nobody owns the thali, it reads as
  // Indian instantly, and being a *shape* rather than a colour it survives
  // being screenshotted onto any background.
  const cx = L.W / 2
  const cy = L.cy

  ctx.beginPath()
  ctx.arc(cx, cy, L.rOuter, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.rimOuter
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, L.rOuter - 14, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.rimInner
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, L.rInner, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.surface
  ctx.fill()

  ctx.textAlign = 'center'

  // Without macros the flame keeps the plate from looking empty; with them the
  // katoris are the decoration and a second glyph would just be noise.
  if (!plate) {
    drawFlame(ctx, cx - L.rInner * 0.139, cy - L.rInner * 0.679, L.rInner * 0.277, PALETTE.gradTo)
  }

  // Shrink the hero to fit rather than letting it run over the plate's rim.
  // At the base size three digits are ~65% of the well, so it only bites on a
  // 4-digit streak (~2.7 years), a long formatted weight, or a five-glyph
  // deficit like "3,240" — rare, but the failure mode is a permanently broken
  // share card and there is no way to notice it before a user posts one.
  ctx.fillStyle = PALETTE.ink
  const heroMaxWidth = L.rInner * 1.6
  let heroSize = Math.round(L.rInner * 0.73)
  const heroMin = Math.round(L.rInner * 0.33)
  ctx.font = `700 ${heroSize}px ${fonts.display}`
  while (ctx.measureText(data.hero.value).width > heroMaxWidth && heroSize > heroMin) {
    heroSize -= 8
    ctx.font = `700 ${heroSize}px ${fonts.display}`
  }
  ctx.fillText(data.hero.value, cx, cy + L.rInner * (plate ? -0.022 : 0.11))

  // The label is a sentence fragment now ("kcal under maintenance"), not one
  // word, so it gets the same clamp — it overruns the rim more often than the
  // hero does.
  let labelSize = Math.round(L.rInner * 0.168)
  const labelMaxWidth = L.rInner * 1.72
  ctx.font = `600 ${labelSize}px ${fonts.sans}`
  while (ctx.measureText(data.hero.label).width > labelMaxWidth && labelSize > 22) {
    labelSize -= 2
    ctx.font = `600 ${labelSize}px ${fonts.sans}`
  }
  ctx.fillStyle = PALETTE.ink2
  ctx.fillText(data.hero.label, cx, cy + L.rInner * (plate ? 0.394 : 0.54))

  // Katoris sit on the plate's lower arc, the way they do on a real thali.
  if (plate) {
    const kr = L.rInner * 0.226
    const macros: [number, string, string][] = [
      [plate.protein, PALETTE.protein, 'P'],
      [plate.carbs, PALETTE.carbs, 'C'],
      [plate.fat, PALETTE.fat, 'F'],
    ]
    const spread = L.rInner * 0.613
    macros.forEach(([fraction, color, letter], i) => {
      const kx = cx + (i - 1) * spread
      const ky = cy + L.rInner * 0.65
      drawKatori(ctx, kx, ky, kr, fraction, color)
      ctx.fillStyle = PALETTE.ink2
      ctx.font = `700 ${Math.round(L.rInner * 0.109)}px ${fonts.sans}`
      ctx.fillText(`${letter} ${Math.round(fraction * 100)}%`, kx, ky + kr + L.rInner * 0.124)
    })
  }

  // Subline. Clamped too: on a story card this is read at ~360px tall in a
  // status list, so a line that overflows is a line nobody can read.
  if (data.subline) {
    let subSize = 44
    ctx.font = `600 ${subSize}px ${fonts.sans}`
    while (ctx.measureText(data.subline).width > L.W - 120 && subSize > 26) {
      subSize -= 2
      ctx.font = `600 ${subSize}px ${fonts.sans}`
    }
    ctx.fillStyle = PALETTE.good
    ctx.fillText(data.subline, cx, L.sublineY)
  }

  // Footer band — accent gradient with the site URL
  const bandGrad = ctx.createLinearGradient(0, L.H - L.bandH, L.W * 0.4, L.H)
  bandGrad.addColorStop(0, PALETTE.gradFrom)
  bandGrad.addColorStop(1, PALETTE.gradTo)
  ctx.fillStyle = bandGrad
  ctx.fillRect(0, L.H - L.bandH, L.W, L.bandH)
  ctx.font = `600 38px ${fonts.sans}`
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText('getinshape.co.in · Indian Calorie Tracker', L.W / 2, L.H - L.bandH / 2 + 2)
}

/** Resolve the app's real font stacks so the card matches the UI type. */
export function resolveFonts(): { display: string; sans: string } {
  const root = getComputedStyle(document.documentElement)
  return {
    display: root.getPropertyValue('--font-display').trim() || 'Inter Tight, sans-serif',
    sans: root.getPropertyValue('--font-sans').trim() || 'Inter, sans-serif',
  }
}

/**
 * Render + share the card. Returns how it was delivered: 'shared' via the
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

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not render the card')

  const name = `getinshape-progress-${format}.png`
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

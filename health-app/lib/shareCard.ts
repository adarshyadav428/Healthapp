/**
 * Share progress card — a 1080×1080 brand image (streak + weight change)
 * rendered client-side to a canvas and handed to the Web Share API
 * (WhatsApp/Instagram on Android) with a download fallback.
 *
 * Data prep is pure (tested); drawing takes the prepared data. The palette is
 * intentionally fixed to the Porcelain light look — a share card is a brand
 * asset and must render identically for dark-theme users, which is why these
 * hex values live here (lib/ is outside the check-tokens scan) and not in a
 * component. Values mirror :root in app/globals.css.
 */

export type ShareCardData = {
  hero: { value: string; label: string }
  subline: string | null
}

export function buildShareCardData(args: {
  streakDays: number
  startWeightKg: number | null
  currentWeightKg: number | null
}): ShareCardData | null {
  const { streakDays, startWeightKg, currentWeightKg } = args
  const lost =
    startWeightKg != null && currentWeightKg != null ? startWeightKg - currentWeightKg : null
  const lostLine = lost != null && lost >= 0.1 ? `${lost.toFixed(1)} kg down` : null

  if (streakDays >= 1) {
    return {
      hero: { value: String(streakDays), label: streakDays === 1 ? 'day streak' : 'day streak' },
      subline: lostLine ? `${lostLine} since starting` : null,
    }
  }
  if (lostLine) {
    return { hero: { value: lostLine.replace(' down', ''), label: 'down since starting' }, subline: null }
  }
  // Nothing to brag about yet — callers hide the share button.
  return null
}

// Porcelain palette + ember gradient (see note above). Macro hues mirror
// --protein/--carbs/--fat in :root; like everything else here they're pinned
// to the light theme so the exported image never depends on the viewer's.
const PALETTE = {
  canvas: '#F7F6F3',
  surface: '#FFFFFF',
  ink: '#17150F',
  ink2: '#6E6963',
  ink3: '#A6A099',
  good: '#3E8A5C',
  gradFrom: '#FF8A50',
  gradTo: '#EB5A20',
  protein: '#4A7DE0',
  carbs: '#E0961F',
  fat: '#E05A4E',
  // Steel rim of the thali — a warm grey so it sits in the Porcelain world
  // rather than looking like a stray UI chrome element.
  rimOuter: '#D8D4CC',
  rimInner: '#EFEDE7',
}

/**
 * The macro split of the plate, as fractions that sum to 1.
 *
 * Separate from ShareCardData on purpose: the streak/weight hero is what the
 * card is *about*, while the plate is decoration that happens to be truthful.
 * Callers without macro data still get a thali, just without the katoris.
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

export function drawShareCard(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
  fonts: { display: string; sans: string },
  plate?: PlateSplit | null
): void {
  const S = 1080
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D not supported')

  // Canvas background
  ctx.fillStyle = PALETTE.canvas
  ctx.fillRect(0, 0, S, S)

  // Brand lockup, top-left: mini icon tile + wordmark
  const tile = 88
  const grad = ctx.createLinearGradient(72, 72, 72 + tile * 0.35, 72 + tile)
  grad.addColorStop(0, PALETTE.gradFrom)
  grad.addColorStop(1, PALETTE.gradTo)
  roundedRect(ctx, 72, 72, tile, tile, 24)
  ctx.fillStyle = grad
  ctx.fill()
  drawFlame(ctx, 72 + tile * 0.2, 72 + tile * 0.2, tile * 0.6, '#FFFFFF')
  ctx.fillStyle = PALETTE.ink
  ctx.font = `700 52px ${fonts.display}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText('GetInShape', 72 + tile + 32, 72 + tile / 2 + 2)

  // ── The thali ───────────────────────────────────────────────────────────
  // A round steel plate, not a rectangle with a number in it. Every tracker
  // in the category ships the rectangle; nobody owns the thali, it reads as
  // Indian instantly, and being a *shape* rather than a colour it survives
  // being screenshotted onto any background.
  const cx = S / 2
  const cy = 540
  const rOuter = 330
  const rInner = 274

  ctx.beginPath()
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.rimOuter
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, rOuter - 14, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.rimInner
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.surface
  ctx.fill()

  ctx.textAlign = 'center'

  // Without macros the flame keeps the plate from looking empty; with them the
  // katoris are the decoration and a second glyph would just be noise.
  if (!plate) drawFlame(ctx, cx - 38, cy - 186, 76, PALETTE.gradTo)

  // Shrink the hero to fit rather than letting it run over the plate's rim.
  // At 200px three digits are ~360px inside a ~548px well, so it only bites on
  // a 4-digit streak (~2.7 years) or a long formatted weight — rare, but the
  // failure mode is a permanently broken share card and there is no way to
  // notice it before a user posts one.
  ctx.fillStyle = PALETTE.ink
  const heroMaxWidth = rInner * 1.6
  let heroSize = 200
  ctx.font = `700 ${heroSize}px ${fonts.display}`
  while (ctx.measureText(data.hero.value).width > heroMaxWidth && heroSize > 90) {
    heroSize -= 8
    ctx.font = `700 ${heroSize}px ${fonts.display}`
  }
  ctx.fillText(data.hero.value, cx, cy + (plate ? -6 : 30))

  ctx.font = `600 46px ${fonts.sans}`
  ctx.fillStyle = PALETTE.ink2
  ctx.fillText(data.hero.label, cx, cy + (plate ? 108 : 148))

  // Katoris sit on the plate's lower arc, the way they do on a real thali.
  if (plate) {
    const kr = 62
    const macros: [number, string, string][] = [
      [plate.protein, PALETTE.protein, 'P'],
      [plate.carbs, PALETTE.carbs, 'C'],
      [plate.fat, PALETTE.fat, 'F'],
    ]
    const spread = 168
    macros.forEach(([fraction, color, letter], i) => {
      const kx = cx + (i - 1) * spread
      const ky = cy + 178
      drawKatori(ctx, kx, ky, kr, fraction, color)
      ctx.fillStyle = PALETTE.ink2
      ctx.font = `700 30px ${fonts.sans}`
      ctx.fillText(`${letter} ${Math.round(fraction * 100)}%`, kx, ky + kr + 34)
    })
  }

  if (data.subline) {
    ctx.font = `600 44px ${fonts.sans}`
    ctx.fillStyle = PALETTE.good
    ctx.fillText(`▼ ${data.subline}`, cx, 940)
  }

  // Footer band — ember gradient with the site URL
  const bandH = 110
  const bandGrad = ctx.createLinearGradient(0, S - bandH, S * 0.4, S)
  bandGrad.addColorStop(0, PALETTE.gradFrom)
  bandGrad.addColorStop(1, PALETTE.gradTo)
  ctx.fillStyle = bandGrad
  ctx.fillRect(0, S - bandH, S, bandH)
  ctx.font = `600 38px ${fonts.sans}`
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText('getinshape.co.in · Indian Calorie Tracker', S / 2, S - bandH / 2 + 2)
}

/** Resolve the app's real font stacks so the card matches the UI type. */
function resolveFonts(): { display: string; sans: string } {
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
  plate?: PlateSplit | null
): Promise<'shared' | 'downloaded'> {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  drawShareCard(canvas, data, resolveFonts(), plate)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not render the card')

  const file = new File([blob], 'getinshape-progress.png', { type: 'image/png' })
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
  a.download = 'getinshape-progress.png'
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}

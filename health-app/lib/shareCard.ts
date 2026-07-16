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

// Porcelain palette + ember gradient (see note above).
const PALETTE = {
  canvas: '#F7F6F3',
  surface: '#FFFFFF',
  ink: '#17150F',
  ink2: '#6E6963',
  ink3: '#A6A099',
  good: '#3E8A5C',
  gradFrom: '#FF8A50',
  gradTo: '#EB5A20',
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

export function drawShareCard(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
  fonts: { display: string; sans: string }
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

  // Hero stat card
  roundedRect(ctx, 72, 260, S - 144, 560, 48)
  ctx.fillStyle = PALETTE.surface
  ctx.fill()

  drawFlame(ctx, S / 2 - 44, 330, 88, PALETTE.gradTo)

  ctx.textAlign = 'center'
  ctx.fillStyle = PALETTE.ink
  ctx.font = `700 260px ${fonts.display}`
  ctx.fillText(data.hero.value, S / 2, 590)

  ctx.font = `600 54px ${fonts.sans}`
  ctx.fillStyle = PALETTE.ink2
  ctx.fillText(data.hero.label, S / 2, 730)

  if (data.subline) {
    ctx.font = `600 44px ${fonts.sans}`
    ctx.fillStyle = PALETTE.good
    ctx.fillText(`▼ ${data.subline}`, S / 2, 880)
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
export async function shareProgressCard(data: ShareCardData): Promise<'shared' | 'downloaded'> {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  drawShareCard(canvas, data, resolveFonts())

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

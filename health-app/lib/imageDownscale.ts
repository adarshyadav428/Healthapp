/**
 * What the camera sends to /api/camera/analyze, and why it is not the raw file.
 *
 * Until 2026-09-18 the gallery path posted the picked file as-is — a 12 MP
 * phone photo is 3–6 MB, base64 makes it a third bigger, and Vercel rejects a
 * request body over 4.5 MB before the route runs, so a normal gallery photo
 * could fail with the generic "unavailable" toast and no Sentry event. The
 * same path also labelled every file `image/jpeg`, PNG or HEIC included.
 *
 * Gemini reads an image in 768 px tiles, so anything much past ~1500 px on the
 * long edge is bytes the model never benefits from. Everything is therefore
 * fitted inside SCAN_MAX_EDGE_PX and re-encoded as JPEG here, in the browser,
 * which also means the mime type is finally true — and, because browsers
 * decode an `<img>` with its EXIF orientation applied, a sideways gallery
 * shot reaches the model upright.
 *
 * The pure pieces (`fitWithin`, `parseDataUrl`) are unit-tested; the canvas
 * work is guarded on `document` so the module can be imported anywhere.
 */

export const SCAN_MAX_EDGE_PX = 1536
export const SCAN_JPEG_QUALITY = 0.85

export type Dimensions = { width: number; height: number }

/**
 * Scales a box down (never up) so its longest edge is at most `maxEdge`,
 * preserving aspect ratio. `scaled` is false when it already fits.
 */
export function fitWithin(width: number, height: number, maxEdge: number): Dimensions & { scaled: boolean } {
  const longest = Math.max(width, height)
  if (!(longest > maxEdge) || !(maxEdge > 0)) return { width, height, scaled: false }
  const s = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * s)),
    height: Math.max(1, Math.round(height * s)),
    scaled: true,
  }
}

/** Splits a `data:<mime>;base64,<payload>` URL. Null for anything else. */
export function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const m = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)(?:;[^,]*?)?;base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl)
  if (!m) return null
  return { mimeType: m[1].toLowerCase(), base64: m[2].replace(/\s+/g, '') }
}

export type ScanImage = {
  base64: string
  mimeType: string
  /** True when the pixels were resized or transcoded here; false when the original went through untouched. */
  downscaled: boolean
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image decode failed'))
    img.src = src
  })
}

/**
 * The one function the camera hook calls before posting a photo. Returns the
 * original payload (with its real mime type) whenever the browser can't
 * decode the file — HEIC on Android, say — because a photo the server may
 * still be able to read beats a client-side error the user can't act on.
 */
export async function prepareScanImage(dataUrl: string): Promise<ScanImage> {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) throw new Error('Not a base64 data URL')
  const original: ScanImage = { ...parsed, downscaled: false }
  if (typeof document === 'undefined' || typeof Image === 'undefined') return original

  try {
    const img = await loadImage(dataUrl)
    const fit = fitWithin(img.naturalWidth, img.naturalHeight, SCAN_MAX_EDGE_PX)
    // A live-camera frame is already a ≤1280 px JPEG at this quality: don't
    // re-encode what is already right.
    if (!fit.scaled && parsed.mimeType === 'image/jpeg') return original

    const canvas = document.createElement('canvas')
    canvas.width = fit.width
    canvas.height = fit.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.drawImage(img, 0, 0, fit.width, fit.height)
    const out = parseDataUrl(canvas.toDataURL('image/jpeg', SCAN_JPEG_QUALITY))
    if (!out) return original
    return { ...out, downscaled: true }
  } catch {
    return original
  }
}

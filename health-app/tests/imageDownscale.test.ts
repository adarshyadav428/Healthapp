/**
 * lib/imageDownscale.ts — the pure halves of what the camera sends.
 *
 * `fitWithin` decides whether a photo is resized and to what; `parseDataUrl`
 * is what makes the mime type on the wire true instead of the hardcoded
 * 'image/jpeg' the gallery path used to send for every file. The canvas half
 * is a browser concern and is exercised on a device, not here.
 */
import { describe, expect, it } from 'vitest'
import { fitWithin, parseDataUrl, SCAN_MAX_EDGE_PX } from '../lib/imageDownscale'

describe('fitWithin', () => {
  it('leaves a photo that already fits untouched', () => {
    expect(fitWithin(1280, 720, SCAN_MAX_EDGE_PX)).toEqual({ width: 1280, height: 720, scaled: false })
    expect(fitWithin(1536, 1152, 1536)).toEqual({ width: 1536, height: 1152, scaled: false })
  })

  it('scales a 12 MP landscape photo down to the long edge, preserving aspect', () => {
    expect(fitWithin(4000, 3000, 1536)).toEqual({ width: 1536, height: 1152, scaled: true })
  })

  it('scales by the long edge whichever axis it is on (portrait)', () => {
    expect(fitWithin(3000, 4000, 1536)).toEqual({ width: 1152, height: 1536, scaled: true })
  })

  it('never upscales and never returns a zero dimension', () => {
    expect(fitWithin(100, 50, 1536).scaled).toBe(false)
    expect(fitWithin(10000, 1, 1536)).toEqual({ width: 1536, height: 1, scaled: true })
  })

  it('treats a non-positive max edge as "no limit"', () => {
    expect(fitWithin(4000, 3000, 0).scaled).toBe(false)
  })
})

describe('parseDataUrl', () => {
  it('reads the real mime type off a PNG, WebP or HEIC data URL — not whatever the caller assumed', () => {
    expect(parseDataUrl('data:image/png;base64,iVBORw0KGgo=')).toEqual({ mimeType: 'image/png', base64: 'iVBORw0KGgo=' })
    expect(parseDataUrl('data:image/webp;base64,UklGRg==')?.mimeType).toBe('image/webp')
    expect(parseDataUrl('data:image/heic;base64,AAAA')?.mimeType).toBe('image/heic')
  })

  it('lower-cases the mime type and tolerates extra parameters', () => {
    expect(parseDataUrl('data:IMAGE/JPEG;charset=binary;base64,/9j/4AAQ')).toEqual({ mimeType: 'image/jpeg', base64: '/9j/4AAQ' })
  })

  it('strips whitespace a FileReader may wrap into the payload', () => {
    expect(parseDataUrl('data:image/jpeg;base64,/9j/\n4AAQ')?.base64).toBe('/9j/4AAQ')
  })

  it('returns null for anything that is not a base64 data URL', () => {
    expect(parseDataUrl('https://example.com/a.jpg')).toBeNull()
    expect(parseDataUrl('data:text/plain,hello')).toBeNull()
    expect(parseDataUrl('')).toBeNull()
  })
})

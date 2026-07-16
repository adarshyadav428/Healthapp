import { describe, it, expect } from 'vitest'
import { normalizeBarcode } from '../lib/barcode'

describe('normalizeBarcode', () => {
  it('accepts real barcode formats', () => {
    expect(normalizeBarcode('8901058851298')).toBe('8901058851298') // EAN-13 (Maggi)
    expect(normalizeBarcode('12345678')).toBe('12345678') // EAN-8
    expect(normalizeBarcode('123456789012')).toBe('123456789012') // UPC-A
  })

  it('strips scanner separators', () => {
    expect(normalizeBarcode(' 890-1058-851298 ')).toBe('8901058851298')
  })

  it('rejects PostgREST filter-injection payloads (regression)', () => {
    // previously reached `.or(`source_id.eq.offi_${code},…`)` raw
    expect(normalizeBarcode('1,source.eq.user)')).toBeNull()
    expect(normalizeBarcode('123.json?x=')).toBeNull()
    expect(normalizeBarcode('../etc')).toBeNull()
  })

  it('rejects empty/absent/implausible values', () => {
    expect(normalizeBarcode(null)).toBeNull()
    expect(normalizeBarcode(undefined)).toBeNull()
    expect(normalizeBarcode('')).toBeNull()
    expect(normalizeBarcode('12345')).toBeNull() // too short
    expect(normalizeBarcode('123456789012345')).toBeNull() // too long
    expect(normalizeBarcode('abcdefgh')).toBeNull()
  })
})

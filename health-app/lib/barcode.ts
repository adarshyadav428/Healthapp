/**
 * Normalize a scanned barcode for lookup.
 *
 * Real product barcodes (EAN-8/13, UPC-A, GTIN-14) are 6–14 digits. The
 * barcode route interpolates the value into a PostgREST `.or()` filter and
 * into the Open Food Facts URL path, so anything non-numeric must be
 * rejected before it reaches either (same delimiter-injection class as the
 * food-search filter bug).
 *
 * Returns the digits-only barcode, or null if the input isn't a plausible barcode.
 */
export function normalizeBarcode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const code = raw.trim().replace(/[\s-]/g, '') // scanners sometimes include separators
  return /^\d{6,14}$/.test(code) ? code : null
}

import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'
import { normalizeBarcode } from '../../../../lib/barcode'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  // Digits-only (6–14) — the raw value is interpolated into a PostgREST
  // .or() filter and the OFF URL path, so it must be validated first.
  const barcode = normalizeBarcode(searchParams.get('code'))
  if (!barcode) return NextResponse.json({ error: 'No valid barcode provided' }, { status: 400 })

  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check local DB first — covers pre-seeded OFF items and previously scanned products
  const { data: existing } = await supabase
    .from('foods')
    .select('*')
    .or(`source_id.eq.offi_${barcode},source_id.eq.off_${barcode}`)
    .maybeSingle()

  if (existing) return NextResponse.json(existing)

  // Fetch from Open Food Facts world API (covers both Indian and global barcodes)
  let product: Record<string, unknown> | null = null
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v3/product/${barcode}.json`, {
      headers: { 'User-Agent': 'GetInShape/1.0 (getinshape.app, Indian calorie tracker)' },
      signal: AbortSignal.timeout(6000),
    })
    if (res.ok) {
      const data = await res.json()
      product = data.product ?? null
    }
  } catch { /* network error — fall through to 404 */ }

  if (!product || !product.product_name) {
    return NextResponse.json({ error: 'Product not found. Try searching by name.' }, { status: 404 })
  }

  const n = (product.nutriments ?? {}) as Record<string, number>
  const kcal =
    n['energy-kcal_100g'] ??
    (n['energy_100g'] ? Math.round(n['energy_100g'] / 4.184) : 0)

  if (kcal === 0 && !n['proteins_100g'] && !n['carbohydrates_100g']) {
    return NextResponse.json({ error: 'No nutrition data for this product.' }, { status: 404 })
  }

  const countriesTags = (product.countries_tags ?? []) as string[]
  const isIndia = countriesTags.some((t) => t.includes('india'))
  const idPrefix = isIndia ? 'offi' : 'off'

  const servingStr = (product.serving_size as string) ?? '100g'
  const servingMatch = servingStr.match(/(\d+(?:\.\d+)?)\s*(?:g|ml)/i)
  const serving_size_g = servingMatch ? Math.round(parseFloat(servingMatch[1])) : 100

  const row = {
    source: 'off',
    source_id: `${idPrefix}_${barcode}`,
    name: (product.product_name as string).trim(),
    brand: (product.brands as string | undefined)?.split(',')[0]?.trim() || null,
    serving_size_g,
    serving_description: servingStr || `${serving_size_g}g`,
    kcal_per_100g: Math.round(kcal * 10) / 10,
    protein_g_per_100g: Math.round((n['proteins_100g'] ?? 0) * 10) / 10,
    carbs_g_per_100g: Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
    fat_g_per_100g: Math.round((n['fat_100g'] ?? 0) * 10) / 10,
    fiber_g_per_100g: n['fiber_100g'] != null ? Math.round(n['fiber_100g'] * 10) / 10 : null,
    brand_owner: null,
    common_portions: null,
  }

  const { data: inserted } = await supabase
    .from('foods')
    .upsert(row, { onConflict: 'source,source_id' })
    .select('*')
    .single()

  return NextResponse.json(inserted ?? row)
}

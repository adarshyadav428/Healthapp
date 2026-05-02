import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '../../../../lib/supabase/server'
import type { Food } from '../../../../types/index'

export const runtime = 'nodejs'

const rateMap = new Map<string, { count: number; reset: number }>()

function rateLimit(ip: string, limit = 30, windowMs = 60_000) {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || entry.reset < now) {
    rateMap.set(ip, { count: 1, reset: now + windowMs })
    return false
  }
  if (entry.count >= limit) return true
  entry.count += 1
  return false
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    if (!query) return NextResponse.json([])

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (rateLimit(ip)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const supabase = createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError) throw new Error(userError.message)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: localResults, error: localError } = await supabase
      .from('foods')
      .select('*')
      .textSearch('name', query)
      .limit(10)

    if (localError) throw new Error(localError.message)

    let results = (localResults ?? []) as Food[]

    if (results.length < 5) {
      const usdaKey = process.env.USDA_API_KEY
      if (usdaKey) {
        const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(
          query
        )}&api_key=${usdaKey}&pageSize=10`
        const usdaRes = await fetch(usdaUrl)
        if (usdaRes.ok) {
          type Nutrient = { nutrientName: string; value: number }
          type UsdaFood = {
            fdcId: number
            description: string
            brandOwner?: string
            foodNutrients?: Nutrient[]
          }
          type UsdaResponse = { foods?: UsdaFood[] }

          const usdaJson = (await usdaRes.json()) as UsdaResponse
          const mapped: Food[] = (usdaJson.foods || []).map((item) => ({
            id: crypto.randomUUID(),
            source: 'usda',
            source_id: String(item.fdcId),
            name: item.description,
            brand: item.brandOwner ?? null,
            serving_size_g: 100,
            serving_description: '100g',
            kcal_per_100g: item.foodNutrients?.find((n) => n.nutrientName === 'Energy')?.value ?? 0,
            protein_g_per_100g: item.foodNutrients?.find((n) => n.nutrientName === 'Protein')?.value ?? 0,
            carbs_g_per_100g:
              item.foodNutrients?.find((n) => n.nutrientName === 'Carbohydrate, by difference')?.value ?? 0,
            fat_g_per_100g: item.foodNutrients?.find((n) => n.nutrientName === 'Total lipid (fat)')?.value ?? 0,
            fiber_g_per_100g: item.foodNutrients?.find((n) => n.nutrientName === 'Fiber, total dietary')?.value ?? null,
          }))

          const admin = createAdminClient()
          if (mapped.length > 0) {
            const { error: insertError } = await admin.from('foods').upsert(
              mapped.map((f) => ({
                id: f.id,
                source: f.source,
                source_id: f.source_id,
                name: f.name,
                brand: f.brand,
                serving_size_g: f.serving_size_g,
                serving_description: f.serving_description,
                kcal_per_100g: f.kcal_per_100g,
                protein_g_per_100g: f.protein_g_per_100g,
                carbs_g_per_100g: f.carbs_g_per_100g,
                fat_g_per_100g: f.fat_g_per_100g,
                fiber_g_per_100g: f.fiber_g_per_100g,
              })),
              { onConflict: 'source,source_id' }
            )
            if (insertError) throw new Error(insertError.message)
          }

          const combined = [...results, ...mapped]
          const deduped = new Map<string, Food>()
          combined.forEach((food) => {
            const key = `${food.name}-${food.brand ?? ''}`.toLowerCase()
            if (!deduped.has(key)) deduped.set(key, food)
          })
          results = Array.from(deduped.values()).slice(0, 10)
        }
      }
    }

    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

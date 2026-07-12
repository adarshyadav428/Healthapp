import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '../../../../lib/supabase/server'
import { getIstDayRange } from '../../../../lib/dateUtils'
import { captureServerEvent } from '../../../../lib/posthog/server'
import { INDIAN_PORTION_REFERENCE } from '../../../../lib/indian-portions'

const FREE_DAILY_LIMIT = 5

const PROMPT = `You are a nutrition expert specializing in Indian food. Analyze this food image.
Use IFCT 2017 values for traditional Indian foods and standard global values for packaged/international foods.

${INDIAN_PORTION_REFERENCE}
Adjust these baselines up or down based on what you actually see in the image.

RULES:
1. Be specific with names: prefer "Aloo Paratha" over "Paratha", "Paneer Butter Masala" over "Curry".
2. For a thali or plate with multiple distinct items, list the 3 most calorie-significant ones separately.
3. Adjust estimated_grams based on plate/bowl size visible in the image. A restaurant plate is 30-50% larger than a home katori.
4. When no size reference is visible, default to standard home-cooked Indian portions (NOT Western restaurant sizes).
5. Set confidence "low" if the image is blurry, partially obscured, or you are genuinely unsure of the dish.
6. Set "unit" to "ml" for liquids/beverages (buttermilk, lassi, milk, juice, tea, coffee, soup); otherwise "g". estimated_grams holds the portion amount in whichever unit you chose.

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "foods": [
    {
      "name": "Food name in English",
      "estimated_grams": 150,
      "unit": "g",
      "kcal_per_100g": 180,
      "protein_g_per_100g": 8.0,
      "carbs_g_per_100g": 25.0,
      "fat_g_per_100g": 5.0
    }
  ],
  "confidence": "low|medium|high"
}
List up to 3 distinct food items. If you cannot identify any food, return {"foods":[],"confidence":"low"}.`

function stripMarkdown(text: string): string {
  return text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
}

export async function POST(req: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = user.id

  // Check Pro status
  const { data: sub } = await supabase
    .from('subscriptions').select('status').eq('user_id', userId).maybeSingle()
  const isPro = Boolean(sub && (sub.status === 'active' || sub.status === 'trialing'))

  // Rate limit: free users get 5 photo AI scans per IST day
  if (!isPro) {
    const { start: todayStart } = getIstDayRange()
    const { count } = await supabase
      .from('camera_photo_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', todayStart)

    if ((count ?? 0) >= FREE_DAILY_LIMIT) {
      captureServerEvent(userId, 'paywall_viewed', { reason: 'camera_scan_limit' })
      return NextResponse.json(
        { error: `You've used all ${FREE_DAILY_LIMIT} free photo scans for today.`, upgrade: true },
        { status: 429 }
      )
    }
  }

  const body = await req.json().catch(() => null)
  if (!body?.imageBase64) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }
  const { imageBase64, mimeType = 'image/jpeg', context } = body as { imageBase64: string; mimeType?: string; context?: string }
  const userContext = typeof context === 'string' ? context.trim().slice(0, 200) : ''

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
  }

  const promptWithContext = userContext
    ? `${PROMPT}\n\nAdditional context from the user about this food (use it to refine your estimate, but don't let it override what you actually see in the image): "${userContext}"`
    : PROMPT

  // Call Gemini 1.5 Flash via direct REST API (avoids SDK v1beta routing issues)
  let geminiResult: { foods: Array<{ name: string; estimated_grams: number; unit?: string; kcal_per_100g: number; protein_g_per_100g: number; carbs_g_per_100g: number; fat_g_per_100g: number }>; confidence: string }
  try {
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: promptWithContext },
            ],
          }],
          generationConfig: { maxOutputTokens: 512, temperature: 0.05 },
        }),
      }
    )
    const apiJson = await apiRes.json()
    if (!apiRes.ok) {
      const errMsg = apiJson?.error?.message ?? JSON.stringify(apiJson)
      return NextResponse.json({ error: `Gemini error: ${errMsg}` }, { status: 500 })
    }
    const raw = stripMarkdown(apiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? '')
    try {
      geminiResult = JSON.parse(raw)
    } catch {
      // Gemini returned text instead of JSON (refusal, apology, etc.)
      return NextResponse.json(
        { error: 'Could not identify any food in the image. Try better lighting or point at food directly.' },
        { status: 422 }
      )
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: `AI analysis failed: ${msg}` }, { status: 500 })
  }

  if (!geminiResult.foods?.length) {
    return NextResponse.json(
      { error: 'Could not identify any food in the image. Try better lighting or a closer shot.' },
      { status: 422 }
    )
  }

  // For each food: find in DB or create an estimate entry
  const admin = createAdminClient()
  const enrichedFoods = []

  for (const item of geminiResult.foods.slice(0, 3)) {
    // Prefer an existing DB entry by name match
    const { data: existing } = await supabase
      .from('foods')
      .select('id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions')
      .ilike('name', `%${item.name}%`)
      .neq('source', 'estimate')
      .order('source', { ascending: true }) // ifct before off
      .limit(1)
      .maybeSingle()

    const unit = item.unit === 'ml' ? 'ml' : 'g'

    if (existing) {
      enrichedFoods.push({ ...existing, estimated_grams: item.estimated_grams || existing.serving_size_g || 100, unit })
      continue
    }

    // No match — upsert an estimate food so we have a stable food_id to log against
    const source_id = `est_${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50)}`
    const { data: created, error: upsertErr } = await admin
      .from('foods')
      .upsert(
        {
          source: 'estimate',
          source_id,
          name: item.name,
          brand: null,
          serving_size_g: item.estimated_grams || 100,
          serving_description: `${item.estimated_grams || 100}g`,
          kcal_per_100g: Math.round((item.kcal_per_100g || 0) * 10) / 10,
          protein_g_per_100g: Math.round((item.protein_g_per_100g || 0) * 10) / 10,
          carbs_g_per_100g: Math.round((item.carbs_g_per_100g || 0) * 10) / 10,
          fat_g_per_100g: Math.round((item.fat_g_per_100g || 0) * 10) / 10,
          fiber_g_per_100g: null,
          common_portions: null,
        },
        { onConflict: 'source,source_id' }
      )
      .select('id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions')
      .single()

    if (upsertErr) {
      return NextResponse.json({ error: `DB upsert failed: ${upsertErr.message}` }, { status: 500 })
    }

    if (created) {
      enrichedFoods.push({ ...created, estimated_grams: item.estimated_grams || created.serving_size_g || 100, unit })
    }
  }

  if (!enrichedFoods.length) {
    return NextResponse.json({ error: 'Could not match identified food to database.' }, { status: 422 })
  }

  // Record the scan (for rate limiting)
  await supabase.from('camera_photo_logs').insert({ user_id: userId })

  captureServerEvent(userId, 'ai_scan_completed', { type: 'camera', confidence: geminiResult.confidence })

  return NextResponse.json({ foods: enrichedFoods, confidence: geminiResult.confidence })
}

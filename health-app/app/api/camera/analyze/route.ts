import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createServerClient, createAdminClient } from '../../../../lib/supabase/server'

const FREE_DAILY_LIMIT = 5

const PROMPT = `You are a nutrition expert specializing in Indian food. Analyze this food image.
Use IFCT 2017 values for traditional Indian foods, and standard global values for packaged/international foods.
Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "foods": [
    {
      "name": "Food name in English",
      "estimated_grams": 150,
      "kcal_per_100g": 180,
      "protein_g_per_100g": 8.0,
      "carbs_g_per_100g": 25.0,
      "fat_g_per_100g": 5.0
    }
  ],
  "confidence": "low|medium|high"
}
List up to 3 distinct food items if multiple are visible. If you cannot identify any food, return {"foods":[],"confidence":"low"}.`

function stripMarkdown(text: string): string {
  return text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
}

export async function POST(req: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  // Check Pro status
  const { data: sub } = await supabase
    .from('subscriptions').select('status').eq('user_id', userId).maybeSingle()
  const isPro = Boolean(sub && (sub.status === 'active' || sub.status === 'trialing'))

  // Rate limit: free users get 5 photo AI scans per UTC day
  if (!isPro) {
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('camera_photo_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString())

    if ((count ?? 0) >= FREE_DAILY_LIMIT) {
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
  const { imageBase64, mimeType = 'image/jpeg' } = body as { imageBase64: string; mimeType?: string }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
  }

  // Call Gemini Flash
  let geminiResult: { foods: Array<{ name: string; estimated_grams: number; kcal_per_100g: number; protein_g_per_100g: number; carbs_g_per_100g: number; fat_g_per_100g: number }>; confidence: string }
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash' })
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: PROMPT },
        ],
      }],
    })
    const raw = stripMarkdown(result.response.text())
    geminiResult = JSON.parse(raw)
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

    if (existing) {
      enrichedFoods.push({ ...existing, estimated_grams: item.estimated_grams || existing.serving_size_g || 100 })
      continue
    }

    // No match — upsert an estimate food so we have a stable food_id to log against
    const source_id = `est_${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50)}`
    const { data: created } = await admin
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

    if (created) {
      enrichedFoods.push({ ...created, estimated_grams: item.estimated_grams || created.serving_size_g || 100 })
    }
  }

  if (!enrichedFoods.length) {
    return NextResponse.json({ error: 'Could not match identified food to database.' }, { status: 422 })
  }

  // Record the scan (for rate limiting)
  await supabase.from('camera_photo_logs').insert({ user_id: userId })

  return NextResponse.json({ foods: enrichedFoods, confidence: geminiResult.confidence })
}

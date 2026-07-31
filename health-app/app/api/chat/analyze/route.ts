import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createServerClient, createAdminClient } from '../../../../lib/supabase/server'
import { isProStatus } from '../../../../lib/subscription'
import { CHAT_LOG_PROMPT, stripMarkdown } from '../../../../lib/chat-prompt'
import { pickBestFoodMatch } from '../../../../lib/foodMatch'
import { captureServerEvent } from '../../../../lib/posthog/server'
import { recordAiUsage } from '../../../../lib/usageCounter'
import { AI_TRIAL_SCANS } from '../../../../lib/aiTrial'
import { checkAiTrial } from '../../../../lib/aiTrialServer'

const GEMINI_TIMEOUT_MS = 20_000

// Usage is only recorded on success (recordAiUsage runs after every failure
// return below), so "it hasn't used a scan" is literally true.
const AI_TIMEOUT = 'That took too long to read. Check your connection and try again — it hasn’t used a scan.'
const AI_UNAVAILABLE = 'AI logging is unavailable right now. Try again in a minute, or add the food by search — that always works.'

type GeminiItem = {
  name: string
  portion_desc: string
  grams: number
  kcal_per_100g: number
  protein_g_per_100g: number
  carbs_g_per_100g: number
  fat_g_per_100g: number
}

export async function POST(req: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = user.id

  const { data: sub } = await supabase
    .from('subscriptions').select('status').eq('user_id', userId).maybeSingle()
  const isPro = isProStatus(sub?.status)

  // AI chat logging is Pro-only — same reasoning as the camera scan route, and
  // it draws on the same shared lifetime trial pool.
  if (!isPro) {
    const trial = await checkAiTrial(supabase, userId)
    if (!trial.allowed) {
      captureServerEvent(userId, 'paywall_viewed', { source: 'chat_scan_pro', block: trial.block })
      return NextResponse.json(
        {
          error: trial.block === 'unverified'
            ? `Confirm your email to unlock ${AI_TRIAL_SCANS} free AI scans.`
            : 'AI meal logging is a Pro feature.',
          upgrade: true,
          block: trial.block,
        },
        { status: 403 }
      )
    }
  }

  const body = await req.json().catch(() => null)
  if (!body?.message?.trim()) {
    return NextResponse.json({ error: 'No message provided' }, { status: 400 })
  }

  const { message, currentTime } = body as { message: string; currentTime?: string }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
  }

  const userContent = currentTime
    ? `Time of day: ${currentTime}\n\nMeal description: ${message}`
    : `Meal description: ${message}`

  let parsed: { meal: string; items: GeminiItem[]; error?: string }
  try {
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: CHAT_LOG_PROMPT }] },
          contents: [{ parts: [{ text: userContent }] }],
          generationConfig: { maxOutputTokens: 800, temperature: 0.1 },
        }),
        // See app/api/camera/analyze/route.ts — an untimed Gemini call holds the
        // request until the platform kills it, and the user just watches it die.
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      }
    )
    const apiJson = await apiRes.json()
    if (!apiRes.ok) {
      // Provider text goes to Sentry, not to the user's screen.
      const errMsg = apiJson?.error?.message ?? JSON.stringify(apiJson)
      Sentry.captureException(new Error(`Gemini error: ${errMsg}`), { tags: { route: 'chat/analyze' } })
      return NextResponse.json({ error: AI_UNAVAILABLE }, { status: 503 })
    }
    const raw = stripMarkdown(apiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? '')
    parsed = JSON.parse(raw)
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
    Sentry.captureException(e, { tags: { route: 'chat/analyze', timedOut: String(timedOut) } })
    return NextResponse.json(
      { error: timedOut ? AI_TIMEOUT : AI_UNAVAILABLE },
      { status: 503 }
    )
  }

  if (parsed.error === 'not_food') {
    return NextResponse.json({ error: 'That doesn\'t look like a meal description. Try: "4 roti, dal, sabzi"' }, { status: 422 })
  }

  if (!parsed.items?.length) {
    return NextResponse.json({ error: 'Could not identify any food items. Please be more specific.' }, { status: 422 })
  }

  const admin = createAdminClient()
  const FOOD_SELECT = 'id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions'

  const enrichedItems = await Promise.all(
    parsed.items.slice(0, 8).map(async (item) => {
      const { data: candidates } = await supabase
        .from('foods')
        .select(FOOD_SELECT)
        .ilike('name', `%${item.name}%`)
        .neq('source', 'estimate')
        .limit(10)
      const existing = pickBestFoodMatch(candidates ?? [], item.name)

      if (existing) {
        return { food: existing, grams: item.grams, portion_desc: item.portion_desc }
      }

      const source_id = `est_${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50)}`
      const { data: created } = await admin
        .from('foods')
        .upsert(
          {
            source: 'estimate',
            source_id,
            name: item.name,
            brand: null,
            serving_size_g: item.grams || 100,
            serving_description: item.portion_desc || `${item.grams}g`,
            kcal_per_100g: Math.round((item.kcal_per_100g || 0) * 10) / 10,
            protein_g_per_100g: Math.round((item.protein_g_per_100g || 0) * 10) / 10,
            carbs_g_per_100g: Math.round((item.carbs_g_per_100g || 0) * 10) / 10,
            fat_g_per_100g: Math.round((item.fat_g_per_100g || 0) * 10) / 10,
            fiber_g_per_100g: null,
            common_portions: null,
          },
          { onConflict: 'source,source_id' }
        )
        .select(FOOD_SELECT)
        .single()

      return created ? { food: created, grams: item.grams, portion_desc: item.portion_desc } : null
    })
  )

  const validItems = enrichedItems.filter(Boolean) as { food: Record<string, unknown>; grams: number; portion_desc: string }[]

  if (!validItems.length) {
    return NextResponse.json({ error: 'Could not match any food to the database.' }, { status: 422 })
  }

  await recordAiUsage(supabase, 'chat_logs', userId)

  captureServerEvent(userId, 'ai_scan_completed', { type: 'chat', items: validItems.length })

  return NextResponse.json({ meal: parsed.meal, items: validItems })
}

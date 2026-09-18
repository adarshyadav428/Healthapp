import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createServerClient, createAdminClient } from '../../../../lib/supabase/server'
import { getIsPro, SubscriptionReadError } from '../../../../lib/subscription'
import { CHAT_LOG_PROMPT, CHAT_RESPONSE_SCHEMA, stripMarkdown } from '../../../../lib/chat-prompt'
import { pickBestFoodMatch } from '../../../../lib/foodMatch'
import { parseStatedTotal, rebalanceChatItems, type ChatItem } from '../../../../lib/chat-nutrition'
import { captureServerEvent } from '../../../../lib/posthog/server'
import { recordAiUsage } from '../../../../lib/usageCounter'
import { AI_TRIAL_SCANS } from '../../../../lib/aiTrial'
import { checkAiTrial } from '../../../../lib/aiTrialServer'
import { callGemini } from '../../../../lib/gemini'

// Per attempt; lib/gemini may try the fallback model once. See camera/analyze.
const GEMINI_TIMEOUT_MS = 15_000

// Usage is only recorded on success (recordAiUsage runs after every failure
// return below), so "it hasn't used a scan" is literally true.
const AI_TIMEOUT = 'That took too long to read. Check your connection and try again — it hasn’t used a scan.'
const AI_UNAVAILABLE = 'AI logging is unavailable right now. Try again in a minute, or add the food by search — that always works.'

type GeminiItem = ChatItem

export async function POST(req: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = user.id

  // getIsPro throws on a failed read rather than silently returning false —
  // a DB blip must never look like "genuinely free" and burn a paying
  // user's Pro status or a free user's limited trial call for nothing.
  // 2026-09-05 adversarial-audit F2.
  let isPro: boolean
  try {
    isPro = await getIsPro(supabase, userId)
  } catch (err) {
    if (err instanceof SubscriptionReadError) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    throw err
  }

  // AI chat logging is Pro-only — same reasoning as the camera scan route, and
  // it draws on the same shared lifetime trial pool.
  // Scans left BEFORE this one is spent (null = Pro). Hoisted so the success
  // return can report the balance — see the camera route for the rationale.
  let trialRemaining: number | null = null
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
    trialRemaining = trial.remaining
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

  const ai = await callGemini(
    {
      system: CHAT_LOG_PROMPT,
      parts: [{ text: userContent }],
      responseSchema: CHAT_RESPONSE_SCHEMA,
      // Eight items plus `low` thinking; 800 was sized for flash-lite with
      // thinking off and truncated a long meal mid-object.
      maxOutputTokens: 4096,
      temperature: 0.1,
      thinking: 'low',
      timeoutMs: GEMINI_TIMEOUT_MS,
    },
    process.env.GEMINI_API_KEY,
  )
  if (!ai.ok) {
    // Provider text goes to Sentry, not to the user's screen.
    Sentry.captureException(new Error(`Gemini ${ai.kind} (${ai.model}, attempt ${ai.attempts}): ${ai.message}`), {
      tags: { route: 'chat/analyze', timedOut: String(ai.kind === 'timeout'), model: ai.model },
    })
    return NextResponse.json({ error: ai.kind === 'timeout' ? AI_TIMEOUT : AI_UNAVAILABLE }, { status: 503 })
  }

  let parsed: { meal: string; items: GeminiItem[]; assumptions?: string | null; error?: string | null }
  try {
    parsed = JSON.parse(stripMarkdown(ai.text))
  } catch {
    Sentry.captureException(new Error(`Gemini unparseable (${ai.model}, finish=${ai.finishReason ?? 'unknown'})`), {
      tags: { route: 'chat/analyze', model: ai.model },
    })
    return NextResponse.json({ error: AI_UNAVAILABLE }, { status: 503 })
  }

  if (parsed.error === 'not_food') {
    return NextResponse.json({ error: 'That doesn\'t look like a meal description. Try: "4 roti, dal, sabzi"' }, { status: 422 })
  }

  if (!parsed.items?.length) {
    return NextResponse.json({ error: 'Could not identify any food items. Please be more specific.' }, { status: 422 })
  }

  // Subtract explicitly-quantified components (e.g. "6 chicken pieces") from
  // a user-stated total (e.g. "750g biryani") rather than trusting the
  // model's own arithmetic — see lib/chat-nutrition.ts for why. This is what
  // stops "biryani 750g" + "chicken 300g" + "gravy 50g" being logged as
  // 1100g when the user only said they ate 750g.
  const stated = parseStatedTotal(message)
  const rebalanced = rebalanceChatItems(
    parsed.items,
    stated,
    typeof parsed.assumptions === 'string' ? parsed.assumptions : ''
  )

  if (rebalanced.mismatch) {
    captureServerEvent(userId, 'ai_parse_sum_mismatch', {
      type: 'chat',
      stated_grams: rebalanced.mismatch.stated_grams,
      parsed_sum_grams: rebalanced.mismatch.parsed_sum_grams,
      action: rebalanced.mismatch.action,
    })
  }

  const admin = createAdminClient()
  const FOOD_SELECT = 'id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions'

  const round1 = (v: number) => Math.round(v * 10) / 10

  type EnrichedItem = {
    food: Record<string, unknown>
    grams: number
    portion_desc: string
    confidence: 'low' | 'medium' | 'high'
    unit?: 'g' | 'pcs'
    count?: number
  } | null
  let enrichedItems: EnrichedItem[]
  try {
    enrichedItems = await Promise.all(
      rebalanced.items.slice(0, 8).map(async (item) => {
        // A discarded error here degrades silently in a way that costs accuracy
        // AND money: `candidates` becomes null, pickBestFoodMatch gets an empty
        // list, no measured IFCT row is ever matched, and we write a fresh
        // estimate row instead — permanently, for a transient blip. The camera
        // route already learned this; report it and carry on rather than 500.
        //
        // Excludes `source='user'` too, same reasoning as camera/analyze: this
        // runs under the CALLER's own session client against RLS that's open
        // to every signed-in user for the shared catalogue, so an unfiltered
        // name match could surface — and then log — another user's private
        // custom food. See lib/foodOwnership.ts.
        const { data: candidates, error: candidatesError } = await supabase
          .from('foods')
          .select(FOOD_SELECT)
          .ilike('name', `%${item.name}%`)
          .neq('source', 'estimate')
          .neq('source', 'user')
          .limit(10)

        if (candidatesError) {
          Sentry.captureException(new Error(`chat food match lookup failed: ${candidatesError.message}`), {
            tags: { route: 'chat/analyze' },
          })
        }
        const existing = pickBestFoodMatch(candidates ?? [], item.name)

        if (existing) {
          return { food: existing, grams: item.grams, portion_desc: item.portion_desc, confidence: item.confidence, unit: item.unit, count: item.count }
        }

        // item's macros are already plausibility-clamped by rebalanceChatItems
        // (see lib/chat-nutrition.ts) — previously this trusted Gemini's raw
        // values outright, so a hallucinated macro set (e.g. 900 kcal/100g
        // dal) became a permanent shared `estimate` row.
        const source_id = `est_${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50)}`
        const { data: created, error: upsertErr } = await admin
          .from('foods')
          .upsert(
            {
              source: 'estimate',
              source_id,
              name: item.name,
              brand: null,
              serving_size_g: item.grams || 100,
              serving_description: item.portion_desc || `${item.grams}g`,
              kcal_per_100g: round1(item.kcal_per_100g),
              protein_g_per_100g: round1(item.protein_g_per_100g),
              carbs_g_per_100g: round1(item.carbs_g_per_100g),
              fat_g_per_100g: round1(item.fat_g_per_100g),
              fiber_g_per_100g: null,
              common_portions: null,
            },
            { onConflict: 'source,source_id' }
          )
          .select(FOOD_SELECT)
          .single()

        if (upsertErr) {
          // An unwritten estimate row can't be logged anyway — surface it
          // rather than silently dropping the item (matches camera/analyze).
          throw new Error(`DB upsert failed: ${upsertErr.message}`)
        }

        return created ? { food: created, grams: item.grams, portion_desc: item.portion_desc, confidence: item.confidence, unit: item.unit, count: item.count } : null
      })
    )
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const validItems = enrichedItems.filter(Boolean) as NonNullable<EnrichedItem>[]

  if (!validItems.length) {
    return NextResponse.json({ error: 'Could not match any food to the database.' }, { status: 422 })
  }

  await recordAiUsage(supabase, 'chat_logs', userId)

  // `model` rides on every AI event so correction rates can be compared
  // across models — the one accuracy signal that needs no ground truth.
  captureServerEvent(userId, 'ai_scan_completed', { type: 'chat', items: validItems.length, model: ai.model })

  const remaining = trialRemaining === null ? null : trialRemaining - 1
  return NextResponse.json({
    meal: parsed.meal,
    items: validItems,
    assumptions: rebalanced.assumptions || null,
    remaining,
    model: ai.model,
  })
}

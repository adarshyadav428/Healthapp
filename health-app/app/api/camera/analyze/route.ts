import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createServerClient, createAdminClient } from '../../../../lib/supabase/server'
import { getIsPro, SubscriptionReadError } from '../../../../lib/subscription'
import { pickBestFoodMatch } from '../../../../lib/foodMatch'
import { captureServerEvent } from '../../../../lib/posthog/server'
import { recordAiUsage } from '../../../../lib/usageCounter'
import { AI_TRIAL_SCANS } from '../../../../lib/aiTrial'
import { checkAiTrial } from '../../../../lib/aiTrialServer'
import { CAMERA_PROMPT } from '../../../../lib/camera-prompt'
import {
  resolveNutrition,
  piecesInServing,
  parseSetting,
  parseSettingHint,
  parseItemConfidence,
  normalizeAlternatives,
  CAMERA_RESPONSE_SCHEMA,
  MAX_CAMERA_ITEMS,
  type GeminiScan,
  type SettingHint,
} from '../../../../lib/camera-nutrition'
import { callGemini } from '../../../../lib/gemini'

/** What each setting chip tells the model, appended to the prompt as context. */
const SETTING_HINT_LINES: Record<SettingHint, string> = {
  home: 'The user says this is home-cooked food.',
  restaurant: 'The user says this is from a restaurant, cloud kitchen or hotel.',
  packaged: 'The user says this is a packaged product with a nutrition label.',
}

// Per attempt. lib/gemini tries the fallback model once on a timeout, so the
// worst case is twice this plus the DB work — still inside the 60 s function
// ceiling, and a late answer beats a prompt error: the point is that the USER
// gets a result, not that the request survives.
const GEMINI_TIMEOUT_MS = 15_000

// User-facing copy for AI failures. Provider error text (model ids, quota and
// key detail) is reported to Sentry instead of being rendered in a toast.
const AI_TIMEOUT = 'The scan took too long. Check your connection and try again — this one is on us, it hasn’t used a scan.'
const AI_UNAVAILABLE = 'Photo scanning is unavailable right now. Try again in a minute, or add the food by search — that always works.'

function stripMarkdown(text: string): string {
  return text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
}

export async function POST(req: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = user.id

  // Check Pro status. getIsPro throws on a failed read rather than silently
  // returning false — a DB blip must never look like "genuinely free" and
  // burn a paying user's Pro status or a free user's limited trial call for
  // nothing. 2026-09-05 adversarial-audit F2.
  let isPro: boolean
  try {
    isPro = await getIsPro(supabase, userId)
  } catch (err) {
    if (err instanceof SubscriptionReadError) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    throw err
  }

  // AI photo scan is Pro-only, minus a small lifetime trial for verified free
  // accounts (see lib/aiTrial). It was previously 5 free scans per IST day —
  // every scan is a paid Gemini call and signup no longer costs an attacker
  // anything, so a renewing allowance was an open tab on our API budget.
  // Enforced here rather than in the UI because the UI is not a security
  // boundary — this route is reachable directly.
  //
  // Scans left BEFORE this one is spent (null = Pro, i.e. unlimited). Hoisted
  // out of the block so the success return can tell the client how many remain.
  let trialRemaining: number | null = null
  if (!isPro) {
    const trial = await checkAiTrial(supabase, userId)
    if (!trial.allowed) {
      captureServerEvent(userId, 'paywall_viewed', { source: 'camera_scan_pro', block: trial.block })
      return NextResponse.json(
        {
          error: trial.block === 'unverified'
            ? `Confirm your email to unlock ${AI_TRIAL_SCANS} free AI scans.`
            : 'AI photo scan is a Pro feature.',
          upgrade: true,
          block: trial.block,
        },
        { status: 403 }
      )
    }
    trialRemaining = trial.remaining
  }

  const body = await req.json().catch(() => null)
  if (!body?.imageBase64) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }
  const { imageBase64, mimeType = 'image/jpeg', context, currentTime, settingHint: rawSettingHint } = body as {
    imageBase64: string
    mimeType?: string
    context?: string
    currentTime?: string
    settingHint?: string
  }
  const userContext = typeof context === 'string' ? context.trim().slice(0, 200) : ''
  // IST wall-clock time from the client (formatIst, same as the chat route).
  // Untrusted input: bounded and stripped of line breaks before it reaches
  // the prompt, so it can only ever be a short token — never an instruction.
  const timeOfDay = typeof currentTime === 'string' ? currentTime.replace(/[\r\n]+/g, ' ').trim().slice(0, 20) : ''
  // One of three chips the user can tap before the shutter. An enum, so the
  // only thing that can reach the prompt is one of our own three words.
  const settingHint = parseSettingHint(rawSettingHint)

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
  }

  const extras = [
    timeOfDay
      ? `Time of day in India when this photo was taken: ${timeOfDay}. Use it to disambiguate breakfast dishes from lunch/dinner ones and to pick typical portions for that meal — never to override what is actually visible.`
      : '',
    settingHint ? `${SETTING_HINT_LINES[settingHint]} Set "setting" accordingly and size portions and oil for it.` : '',
    userContext
      ? `Additional context from the user about this food (use it to refine your estimate, but don't let it override what you actually see in the image): "${userContext}"`
      : '',
  ].filter(Boolean)
  const promptWithContext = extras.length ? `${CAMERA_PROMPT}\n\n${extras.join('\n\n')}` : CAMERA_PROMPT

  const ai = await callGemini(
    {
      parts: [
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
        { text: promptWithContext },
      ],
      responseSchema: CAMERA_RESPONSE_SCHEMA,
      // Thinking tokens count against this. 1024 was enough with thinking off
      // and three items; a thali under `low` thinking needs the headroom.
      maxOutputTokens: 4096,
      // temperature 0 + a fixed seed reduce (but per Google's docs don't
      // guarantee) run-to-run variance — the real bound on residual
      // non-determinism is the plausibility validation in resolveNutrition.
      temperature: 0,
      seed: 42,
      thinking: 'low',
      timeoutMs: GEMINI_TIMEOUT_MS,
    },
    process.env.GEMINI_API_KEY,
  )
  if (!ai.ok) {
    // The provider's own error text is for us, not for the user — it leaks
    // model names and key/quota detail and reads as a crash. Report it, show
    // something a person can act on.
    Sentry.captureException(new Error(`Gemini ${ai.kind} (${ai.model}, attempt ${ai.attempts}): ${ai.message}`), {
      tags: { route: 'camera/analyze', timedOut: String(ai.kind === 'timeout'), model: ai.model },
    })
    return NextResponse.json({ error: ai.kind === 'timeout' ? AI_TIMEOUT : AI_UNAVAILABLE }, { status: 503 })
  }

  let geminiResult: GeminiScan
  try {
    geminiResult = JSON.parse(stripMarkdown(ai.text))
  } catch {
    // Under a response schema this is a truncated answer (MAX_TOKENS) far
    // more often than prose — say which, so the fix is a budget, not a prompt.
    Sentry.captureException(new Error(`Gemini unparseable (${ai.model}, finish=${ai.finishReason ?? 'unknown'})`), {
      tags: { route: 'camera/analyze', model: ai.model },
    })
    return NextResponse.json(
      { error: 'Could not identify any food in the image. Try better lighting or point at food directly.' },
      { status: 422 }
    )
  }

  if (!geminiResult.foods?.length) {
    return NextResponse.json(
      { error: 'Could not identify any food in the image. Try better lighting or a closer shot.' },
      { status: 422 }
    )
  }

  // For each food: find in DB or create an estimate entry
  const admin = createAdminClient()
  const FOOD_SELECT = 'id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions'
  const round1 = (v: number) => Math.round(v * 10) / 10

  type ItemOutcome = {
    clamped: boolean
    enriched?: Record<string, unknown>
    unresolvedName?: string
  }

  // A DB write failure inside the loop below used to end the whole route with
  // a 500 — thrown here to keep that behavior after parallelizing.
  class UpsertFailedError extends Error {}

  // Each item's DB lookup/upsert is independent of every other item's — this
  // used to run one at a time, stacking up to 6 sequential Supabase round
  // trips (2 per item x up to 3 items) on top of the Gemini call that already
  // dominates this route's latency. chat/analyze already parallelizes the
  // same per-item work; this brings camera in line with it.
  let outcomes: ItemOutcome[]
  try {
    outcomes = await Promise.all(
      geminiResult.foods.slice(0, MAX_CAMERA_ITEMS).map(async (item): Promise<ItemOutcome> => {
        const n = resolveNutrition(item)
        const clamped = !n.plausible
        // The model's read of THIS item in THIS photo — not a property of the
        // catalogue row `enriched` is otherwise built from, so it rides along
        // as extra fields rather than living in `foods`.
        const itemAnnotations = {
          item_confidence: parseItemConfidence(item.confidence),
          alternatives: normalizeAlternatives(item.name, item.alternatives),
        }

        // A readable printed panel is authoritative for that exact product — never
        // let a fuzzy name match against a generic DB food override it. A pcs-total
        // or freeform estimate is just Gemini's own guess, so it still gets a
        // chance at the accurate seeded IFCT/restaurant data.
        if (!n.fromLabel) {
          // A discarded error here degrades silently in a way that costs accuracy
          // AND money: `candidates` becomes null, pickBestFoodMatch gets an empty
          // list, no measured IFCT row is ever matched, and we write a fresh
          // per-user `estimate` row instead — permanently, for a transient blip. The
          // scan still succeeds, so nobody finds out. Report it and carry on.
          //
          // Excludes `source='user'` for the same reason `estimate` is excluded:
          // this runs under the CALLER's own session client, and `foods_select`
          // RLS is open to every signed-in user for the shared catalogue — so
          // without this, a photo whose Gemini-guessed name happens to match
          // another user's private custom food more closely than any catalogue
          // row would surface (and then log) that private food for this caller.
          // See lib/foodOwnership.ts.
          const { data: candidates, error: candidatesError } = await supabase
            .from('foods')
            .select(FOOD_SELECT)
            .ilike('name', `%${item.name}%`)
            .neq('source', 'estimate')
            .neq('source', 'user')
            .limit(10)

          if (candidatesError) {
            Sentry.captureException(new Error(`food match lookup failed: ${candidatesError.message}`), {
              tags: { route: 'camera/analyze' },
            })
          }
          const existing = pickBestFoodMatch(candidates ?? [], item.name)

          if (existing) {
            if (n.unit === 'pcs' && existing.serving_size_g > 0) {
              // DB rows are per-100g; a "pcs" item needs a per-100-pieces rate.
              // Convert and cache the derived row so repeat scans of the same
              // branded item reuse it instead of re-deriving (or drifting on
              // Gemini's inconsistent phrasing) each time. Gemini's own visible
              // count (n.portion) stays authoritative — how many pieces are in
              // the photo varies per scan, but the menu item's per-piece
              // nutrition doesn't.
              const gramsPerPiece = existing.serving_size_g / piecesInServing(existing.serving_description)
              const pcsSourceId = `est_pcs_${existing.source}_${existing.source_id}`
              const { data: converted, error: convertErr } = await admin
                .from('foods')
                .upsert(
                  {
                    source: 'estimate',
                    source_id: pcsSourceId,
                    name: existing.name,
                    brand: existing.brand,
                    serving_size_g: Math.round(n.portion),
                    serving_description: `${Math.round(n.portion)} pcs`,
                    kcal_per_100g: round1(existing.kcal_per_100g * gramsPerPiece),
                    protein_g_per_100g: round1(existing.protein_g_per_100g * gramsPerPiece),
                    carbs_g_per_100g: round1(existing.carbs_g_per_100g * gramsPerPiece),
                    fat_g_per_100g: round1(existing.fat_g_per_100g * gramsPerPiece),
                    fiber_g_per_100g: existing.fiber_g_per_100g != null ? round1(existing.fiber_g_per_100g * gramsPerPiece) : null,
                    common_portions: null,
                  },
                  { onConflict: 'source,source_id' }
                )
                .select(FOOD_SELECT)
                .single()

              if (convertErr) throw new UpsertFailedError(`DB upsert failed: ${convertErr.message}`)
              if (converted) {
                return { clamped, enriched: { ...converted, estimated_grams: n.portion, unit: 'pcs', ...itemAnnotations } }
              }
              // Fall through to the generic estimate upsert below if this failed.
            } else if (n.unit !== 'pcs') {
              return {
                clamped,
                enriched: { ...existing, estimated_grams: n.portion || existing.serving_size_g || 100, unit: n.unit, ...itemAnnotations },
              }
            }
          }
        }

        // A "pcs" item resolveNutrition could not derive a safe per-piece rate for
        // (no valid serving total, no label), and that didn't match an existing
        // catalogue row above — the DB-match branch derives its own per-piece rate
        // from existing.serving_size_g and never reaches here — has no defensible
        // number to persist. `n`'s fields are per-100-GRAM at best, and this route
        // always writes a "pcs" food as per-100-PIECE; writing them through would
        // reintroduce the exact 10-100x error this guard exists to prevent. Refuse
        // rather than guess, and tell the caller which item it was.
        if (n.unit === 'pcs' && !n.resolvable) {
          return { clamped, unresolvedName: item.name }
        }

        // Upsert so we have a stable food_id to log against. Label-derived entries
        // overwrite any earlier estimate for the same product with the real values.
        const source_id = `est_${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50)}`
        const { data: created, error: upsertErr } = await admin
          .from('foods')
          .upsert(
            {
              source: 'estimate',
              source_id,
              name: item.name,
              brand: null,
              serving_size_g: Math.round(n.portion),
              serving_description: `${Math.round(n.portion)}${n.unit}`,
              kcal_per_100g: round1(n.kcal_per_100g),
              protein_g_per_100g: round1(n.protein_g_per_100g),
              carbs_g_per_100g: round1(n.carbs_g_per_100g),
              fat_g_per_100g: round1(n.fat_g_per_100g),
              fiber_g_per_100g: null,
              common_portions: null,
            },
            { onConflict: 'source,source_id' }
          )
          .select(FOOD_SELECT)
          .single()

        if (upsertErr) throw new UpsertFailedError(`DB upsert failed: ${upsertErr.message}`)

        return created ? { clamped, enriched: { ...created, estimated_grams: n.portion, unit: n.unit, ...itemAnnotations } } : { clamped }
      })
    )
  } catch (e) {
    if (e instanceof UpsertFailedError) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
    throw e
  }

  const enrichedFoods = outcomes.flatMap(o => (o.enriched ? [o.enriched] : []))
  const unresolvedNames = outcomes.flatMap(o => (o.unresolvedName ? [o.unresolvedName] : []))
  const anyClamped = outcomes.some(o => o.clamped)

  if (!enrichedFoods.length) {
    return NextResponse.json(
      {
        error: unresolvedNames.length
          ? `Couldn't confidently estimate ${unresolvedNames.join(', ')}. Try adding it by search instead — that always works.`
          : 'Could not match identified food to database.',
      },
      { status: 422 }
    )
  }

  // Record the scan (for rate limiting)
  await recordAiUsage(supabase, 'camera_photo_logs', userId)

  // A clamped value means at least one item's numbers were implausible as
  // returned by Gemini — surface the existing low-confidence banner so the
  // user knows to double-check it, even if Gemini itself reported "high".
  const confidence = anyClamped ? 'low' : geminiResult.confidence

  const setting = parseSetting(geminiResult.setting)

  // `model` rides on every AI event so correction rates can be compared
  // across models — the one accuracy signal that needs no ground truth.
  captureServerEvent(userId, 'ai_scan_completed', {
    type: 'camera',
    confidence,
    model: ai.model,
    items: enrichedFoods.length,
    setting,
  })

  // `trialRemaining` was the count before this scan; one has now been spent.
  const remaining = trialRemaining === null ? null : trialRemaining - 1
  return NextResponse.json({
    foods: enrichedFoods,
    confidence,
    remaining,
    model: ai.model,
    setting,
    // Present only when at least one detected item was dropped for lack of a
    // safe number — the common case (nothing dropped) omits the field.
    ...(unresolvedNames.length ? { unresolved: unresolvedNames } : {}),
  })
}

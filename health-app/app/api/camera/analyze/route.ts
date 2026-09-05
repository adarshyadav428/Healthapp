import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createServerClient, createAdminClient } from '../../../../lib/supabase/server'
import { isProStatus } from '../../../../lib/subscription'
import { pickBestFoodMatch } from '../../../../lib/foodMatch'
import { captureServerEvent } from '../../../../lib/posthog/server'
import { recordAiUsage } from '../../../../lib/usageCounter'
import { AI_TRIAL_SCANS } from '../../../../lib/aiTrial'
import { checkAiTrial } from '../../../../lib/aiTrialServer'
import { INDIAN_PORTION_REFERENCE } from '../../../../lib/indian-portions'
import { resolveNutrition, piecesInServing, type GeminiFood } from '../../../../lib/camera-nutrition'

// Generous for flash-lite on a single image, and far inside the platform's
// function ceiling — the point is that the USER gets an answer, not that the
// request survives.
const GEMINI_TIMEOUT_MS = 20_000

// User-facing copy for AI failures. Provider error text (model ids, quota and
// key detail) is reported to Sentry instead of being rendered in a toast.
const AI_TIMEOUT = 'The scan took too long. Check your connection and try again — this one is on us, it hasn’t used a scan.'
const AI_UNAVAILABLE = 'Photo scanning is unavailable right now. Try again in a minute, or add the food by search — that always works.'

const PROMPT = `You are a nutrition expert specializing in Indian food. Analyze this food image.
Use IFCT 2017 values for traditional Indian foods and standard global values for packaged/international foods.

${INDIAN_PORTION_REFERENCE}
Adjust these baselines up or down based on what you actually see in the image.

RULES:
1. Be specific with names: prefer "Aloo Paratha" over "Paratha", "Paneer Butter Masala" over "Curry".
2. For a thali or plate with multiple distinct items, list the 3 most calorie-significant ones separately. This also applies to combo meals, buckets, and platters (e.g. a fried-chicken bucket, a burger value meal): decompose them into their distinct recognizable components using the name each item would have on the restaurant's own menu (for example "Hot Wings", "Chicken Strips", "French Fries"), rather than inventing one combined "bucket"/"combo" line for the whole box.
3. Adjust estimated_grams based on plate/bowl size visible in the image. A restaurant plate is 30-50% larger than a home katori.
4. When no size reference is visible, default to standard home-cooked Indian portions (NOT Western restaurant sizes).
5. Set confidence "low" if the image is blurry, partially obscured, or you are genuinely unsure of the dish.
6. Keep the portion unit the user can see: use "ml" for liquids/beverages (buttermilk, lassi, milk, juice, tea, coffee, soup), "pcs" when the food is naturally counted (for example "6 hot wings" or "2 samosas"), and "g" for weighed foods. estimated_grams holds the displayed amount in that unit.
   - For "pcs", also provide the nutrition for the ENTIRE displayed count in total_kcal, total_protein_g, total_carbs_g, and total_fat_g. Do not estimate a gram weight for pieces or derive nutrition from one. For example, 6 hot wings must return estimated_grams: 6, unit: "pcs", and totals for all 6 wings.
7. PACKAGED PRODUCTS — if ANY printed nutrition panel with numbers is visible, you MUST fill in the "label" object below. This is mandatory, not optional — never leave "label" empty when a panel is visible, and never copy a panel number straight into the top-level kcal_per_100g/protein_g_per_100g/etc. fields (those are for food with NO panel — see rule 8). Do NOT do any arithmetic yourself — you are only transcribing four things off the panel. The application does 100% of the maths.
   - "panel_amount": look at the row of numbers you are about to copy (energy, protein, carbs, fat) and find the quantity written directly above or beside THAT SAME row — the amount those specific numbers belong to. Copy that quantity as a plain number. Examples: a column headed "Per 100 ml" → panel_amount is 100. A column headed "Amount per Serving" next to "Serve Size 45 g" → panel_amount is 45 (the serve size), NOT 100. If you see both a "Per 100g" column and a "Per Serving" column, prefer the "Per 100g" one and set panel_amount to 100.
   - "energy_kcal", "protein_g", "carbs_g", "fat_g": copy the numbers from that exact row, unchanged — these are the values FOR panel_amount, whatever it is.
   - "serving_size": the pack's own stated serving size as a number, if printed separately (e.g. 270 from "Serving Size: 270 ml") — this can differ from panel_amount (see the "Per 100 ml" example above, where serving_size is 270 but panel_amount is 100).
   - "servings_per_pack": e.g. 1 from "Number of Servings in the Pack: 1" or "Servings per container 1".
   - "net_quantity": the total pack size ("Net Quantity: 270 ml", "Net Wt. 90 g", "45g" on a single-serve pack).
   - "unit": "ml" for volumes, "g" for weights.
   WORKED EXAMPLE A (single-serve pack, per-serving-only panel — a protein-chips packet): panel reads "Serve Size 45g • Servings per container 1" and a table headed "Amount per Serving: Energy(kcal) 194, Protein(g) 10, Carbohydrate(g) 29, Total Fat(g) 4", Net Quantity 45g. Correct label object: {"panel_amount": 45, "energy_kcal": 194, "protein_g": 10, "carbs_g": 29, "fat_g": 4, "serving_size": 45, "servings_per_pack": 1, "net_quantity": 45, "unit": "g"}.
   WORKED EXAMPLE B (a buttermilk pouch, per-100ml panel with a separately printed serving size): panel reads "Approximate Values Per 100 ml & Per Serve %RDA: Energy 20 kcal, Protein 1.2g, Carbohydrate 1.2g, Total Fat 1.2g", then separately "Serving Size: 270 ml | Number of Servings in the Pack: 1", Net Quantity 270 ml. The energy/protein/carb/fat numbers belong to the "Per 100 ml" column, NOT to the 270 ml serving size — that 270 is a different, separately-printed number used only for %RDA. Correct label object: {"panel_amount": 100, "energy_kcal": 20, "protein_g": 1.2, "carbs_g": 1.2, "fat_g": 1.2, "serving_size": 270, "servings_per_pack": 1, "net_quantity": 270, "unit": "ml"}.
   Omit "label" (or set it to null) ONLY when there is genuinely no readable printed nutrition panel — e.g. a plate of home-cooked food.
8. For food with NO readable panel, estimate kcal_per_100g and the macros per 100 g/ml yourself as usual and set estimated_grams to the portion you actually see.

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
      "fat_g_per_100g": 5.0,
      "total_kcal": null,
      "total_protein_g": null,
      "total_carbs_g": null,
      "total_fat_g": null,
      "label": {
        "panel_amount": 100,
        "energy_kcal": 20,
        "protein_g": 1.2,
        "carbs_g": 1.2,
        "fat_g": 1.2,
        "serving_size": 270,
        "servings_per_pack": 1,
        "net_quantity": 270,
        "unit": "ml"
      }
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
  const isPro = isProStatus(sub?.status)

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
  const { imageBase64, mimeType = 'image/jpeg', context } = body as { imageBase64: string; mimeType?: string; context?: string }
  const userContext = typeof context === 'string' ? context.trim().slice(0, 200) : ''

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
  }

  const promptWithContext = userContext
    ? `${PROMPT}\n\nAdditional context from the user about this food (use it to refine your estimate, but don't let it override what you actually see in the image): "${userContext}"`
    : PROMPT

  // Call Gemini 1.5 Flash via direct REST API (avoids SDK v1beta routing issues)
  let geminiResult: { foods: GeminiFood[]; confidence: string }
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
          // temperature 0 + a fixed seed reduce (but per Google's docs don't
          // guarantee) run-to-run variance — the real bound on residual
          // non-determinism is the plausibility validation in resolveNutrition.
          generationConfig: { maxOutputTokens: 1024, temperature: 0, seed: 42 },
        }),
        // Without a timeout a stalled Gemini holds the request until the
        // platform kills the whole function, so the user watches a spinner die
        // with no message and no way to retry cheaply. 20s is generous for
        // flash-lite on one image and still well inside the function budget.
        // Open Food Facts has had an explicit timeout for this reason since the
        // failure-handling work; the AI path is the one users actually wait on.
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      }
    )
    const apiJson = await apiRes.json()
    if (!apiRes.ok) {
      // The provider's own error text is for us, not for the user — it leaks
      // model names and key/quota detail and reads as a crash. Report it, show
      // something a person can act on.
      const errMsg = apiJson?.error?.message ?? JSON.stringify(apiJson)
      Sentry.captureException(new Error(`Gemini error: ${errMsg}`), { tags: { route: 'camera/analyze' } })
      return NextResponse.json({ error: AI_UNAVAILABLE }, { status: 503 })
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
    const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
    Sentry.captureException(e, { tags: { route: 'camera/analyze', timedOut: String(timedOut) } })
    return NextResponse.json(
      { error: timedOut ? AI_TIMEOUT : AI_UNAVAILABLE },
      { status: 503 }
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
  const enrichedFoods = []
  // Names of items dropped for lack of a safe number — see the guard below.
  // Reported back to the client rather than silently vanishing from the plate.
  const unresolvedNames: string[] = []
  let anyClamped = false
  const FOOD_SELECT = 'id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions'

  for (const item of geminiResult.foods.slice(0, 3)) {
    const n = resolveNutrition(item)
    if (!n.plausible) anyClamped = true
    const round1 = (v: number) => Math.round(v * 10) / 10

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

          if (convertErr) {
            return NextResponse.json({ error: `DB upsert failed: ${convertErr.message}` }, { status: 500 })
          }
          if (converted) {
            enrichedFoods.push({ ...converted, estimated_grams: n.portion, unit: 'pcs' })
            continue
          }
          // Fall through to the generic estimate upsert below if this failed.
        } else if (n.unit !== 'pcs') {
          enrichedFoods.push({
            ...existing,
            estimated_grams: n.portion || existing.serving_size_g || 100,
            unit: n.unit,
          })
          continue
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
      unresolvedNames.push(item.name)
      continue
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

    if (upsertErr) {
      return NextResponse.json({ error: `DB upsert failed: ${upsertErr.message}` }, { status: 500 })
    }

    if (created) {
      enrichedFoods.push({ ...created, estimated_grams: n.portion, unit: n.unit })
    }
  }

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

  captureServerEvent(userId, 'ai_scan_completed', { type: 'camera', confidence })

  // `trialRemaining` was the count before this scan; one has now been spent.
  const remaining = trialRemaining === null ? null : trialRemaining - 1
  return NextResponse.json({
    foods: enrichedFoods,
    confidence,
    remaining,
    // Present only when at least one detected item was dropped for lack of a
    // safe number — the common case (nothing dropped) omits the field.
    ...(unresolvedNames.length ? { unresolved: unresolvedNames } : {}),
  })
}

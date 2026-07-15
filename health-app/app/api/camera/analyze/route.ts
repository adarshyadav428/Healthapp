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

type LabelPanel = {
  panel_amount?: number
  serving_size?: number
  servings_per_pack?: number
  net_quantity?: number
  unit?: string
  energy_kcal?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
}

type GeminiFood = {
  name: string
  estimated_grams: number
  unit?: string
  kcal_per_100g: number
  protein_g_per_100g: number
  carbs_g_per_100g: number
  fat_g_per_100g: number
  total_kcal?: number
  total_protein_g?: number
  total_carbs_g?: number
  total_fat_g?: number
  label?: LabelPanel | null
}

/** Non-negative finite number, or null. Gemini sometimes returns numerals as strings. */
function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Everything downstream is per-100g/ml, but Indian labels state values per 100g,
 * per serve, or (confusingly) both — "Per 100 ml & Per Serve % RDA" means the
 * nutrients are per 100ml and only the RDA is per serve. Letting the model do
 * this conversion produced wrong numbers repeatedly, so it now only transcribes
 * the panel and the arithmetic happens here, where it's deterministic.
 */
function resolveNutrition(item: GeminiFood) {
  const itemUnit = item.unit === 'ml' || item.unit === 'pcs' ? item.unit : 'g'
  const portion = num(item.estimated_grams) || 100
  const fallback = {
    kcal_per_100g:      num(item.kcal_per_100g) ?? 0,
    protein_g_per_100g: num(item.protein_g_per_100g) ?? 0,
    carbs_g_per_100g:   num(item.carbs_g_per_100g) ?? 0,
    fat_g_per_100g:     num(item.fat_g_per_100g) ?? 0,
    portion,
    unit:               itemUnit,
    fromLabel:          false,
    fromServingTotal:   false,
  }

  // Food logs calculate nutrition from a per-100-unit value. Normalize the
  // supplied total for the exact visible count, so a count is never converted
  // into an estimated gram weight for either display or nutrition math.
  if (itemUnit === 'pcs') {
    const kcal = num(item.total_kcal)
    const protein = num(item.total_protein_g)
    const carbs = num(item.total_carbs_g)
    const fat = num(item.total_fat_g)
    if (kcal !== null && protein !== null && carbs !== null && fat !== null) {
      const scale = 100 / portion
      return {
        kcal_per_100g: kcal * scale,
        protein_g_per_100g: protein * scale,
        carbs_g_per_100g: carbs * scale,
        fat_g_per_100g: fat * scale,
        portion,
        unit: itemUnit,
        fromLabel: false,
        fromServingTotal: true,
      }
    }
    return null
  }

  const label = item.label
  const energy = label ? num(label.energy_kcal) : null
  const panelAmount = label ? num(label.panel_amount) : null
  if (!label || energy === null || !panelAmount) return fallback

  // One formula for every panel shape: a "Per 100 ml" panel has panel_amount=100
  // (scale=1, no-op); a "Per Serving (45g)" panel has panel_amount=45 and scales
  // up. The model never classifies "per-100 vs per-serving" — it just reports
  // the quantity the printed numbers are actually for, which is far less prone
  // to misreading than picking between two abstract categories.
  const scale = 100 / panelAmount
  const kcal100 = energy * scale
  if (!(kcal100 > 0) || kcal100 > 900) return fallback // implausible for any real food

  // Sanity check: energy should roughly match what the macros imply (Atwater
  // factors). A big mismatch means the model likely paired mismatched numbers
  // (e.g. energy from one column, macros from another) — don't trust the panel.
  const protein = num(label.protein_g)
  const carbs = num(label.carbs_g)
  const fat = num(label.fat_g)
  if (protein !== null && carbs !== null && fat !== null) {
    const impliedKcal = protein * 4 + carbs * 4 + fat * 9
    if (impliedKcal > 20 && (energy < impliedKcal * 0.5 || energy > impliedKcal * 1.8)) return fallback
  }

  const servingSize = num(label.serving_size)
  const net = num(label.net_quantity)
  const servings = num(label.servings_per_pack)

  // Single-serve pack → default the portion to the whole pack; otherwise one serving.
  const portion =
    net && (servings === null || servings <= 1) ? net
    : servingSize ? servingSize
    : (num(item.estimated_grams) || 100)

  return {
    kcal_per_100g:      kcal100,
    protein_g_per_100g: (num(label.protein_g) ?? 0) * scale,
    carbs_g_per_100g:   (num(label.carbs_g) ?? 0) * scale,
    fat_g_per_100g:     (num(label.fat_g) ?? 0) * scale,
    portion,
    unit:               label.unit === 'ml' ? 'ml' : label.unit === 'g' ? 'g' : itemUnit,
    fromLabel:          true,
    fromServingTotal:   false,
  }
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
          generationConfig: { maxOutputTokens: 1024, temperature: 0.05 },
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
    const n = resolveNutrition(item)
    if (!n) continue
    const round1 = (v: number) => Math.round(v * 10) / 10

    // A readable printed panel is authoritative for that exact product — never
    // let a fuzzy name match against a generic DB food override it.
    if (!n.fromLabel && !n.fromServingTotal) {
      const { data: existing } = await supabase
        .from('foods')
        .select('id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions')
        .ilike('name', `%${item.name}%`)
        .neq('source', 'estimate')
        .order('source', { ascending: true }) // ifct before off
        .limit(1)
        .maybeSingle()

      if (existing) {
        enrichedFoods.push({
          ...existing,
          estimated_grams: n.portion || existing.serving_size_g || 100,
          unit: n.unit,
        })
        continue
      }
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
      .select('id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions')
      .single()

    if (upsertErr) {
      return NextResponse.json({ error: `DB upsert failed: ${upsertErr.message}` }, { status: 500 })
    }

    if (created) {
      enrichedFoods.push({ ...created, estimated_grams: n.portion, unit: n.unit })
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

// Nutrition-resolution logic for the chat AI logging route. Mirrors
// lib/camera-nutrition.ts, which solved the identical problem for photo
// scans: reuse its plausibility guardrails rather than re-implement them, so
// the two AI paths agree on what "physically impossible" means.
//
// The chat route (app/api/chat/analyze/route.ts) previously trusted Gemini's
// kcal_per_100g/macros verbatim — no clamp, no Atwater check, nothing. A
// hallucinated value (e.g. 900 kcal/100g dal) was written straight into the
// shared `foods` table as a permanent `estimate` row. This file closes that
// gap for the freeform per-100g estimate shape chat always uses (chat has no
// label panel and no "pcs" input, unlike camera).

import { isPlausible, clampToPlausible, num } from './camera-nutrition'
import { foldSpelling } from './spelling-variants'

export type ChatItem = {
  name: string
  portion_desc: string
  grams: number
  /**
   * True when the user gave THIS part its own count/amount inside a larger
   * dish ("6 medium chicken pieces" inside a 750g biryani) — set by the
   * model per CHAT_LOG_PROMPT. False/undefined means this item is the rest
   * of the dish (rice, masala, base) and absorbs whatever a stated total
   * doesn't already account for. See rebalanceChatItems.
   */
  is_stated_component?: boolean
  confidence?: 'low' | 'medium' | 'high'
  kcal_per_100g: number
  protein_g_per_100g: number
  carbs_g_per_100g: number
  fat_g_per_100g: number
}

export type ResolvedNutrition = {
  kcal_per_100g: number
  protein_g_per_100g: number
  carbs_g_per_100g: number
  fat_g_per_100g: number
  /** False when the raw values failed isPlausible and were clamped. */
  plausible: boolean
}

/**
 * The chat analogue of camera-nutrition's resolveNutrition, minus label/pcs
 * handling — chat's model output is always a freeform per-100g estimate.
 * Clamps rather than trusts an implausible value outright, same as camera.
 */
export function resolveChatItemNutrition(item: ChatItem): ResolvedNutrition {
  const kcal = num(item.kcal_per_100g) ?? 0
  const protein = num(item.protein_g_per_100g) ?? 0
  const carbs = num(item.carbs_g_per_100g) ?? 0
  const fat = num(item.fat_g_per_100g) ?? 0
  const plausible = isPlausible(kcal, protein, carbs, fat)
  if (plausible) {
    return { kcal_per_100g: kcal, protein_g_per_100g: protein, carbs_g_per_100g: carbs, fat_g_per_100g: fat, plausible: true }
  }
  return { ...clampToPlausible(protein, carbs, fat), plausible: false }
}

// ── Stated-total rebalancing ──────────────────────────────────────────────
//
// The bug this section closes: "750g of Hyderabadi chicken biryani which
// contained 6 medium chicken pieces along with some gravy" came back as
// THREE items — biryani 750g, chicken 300g, gravy 50g — summing to 1100g,
// because the chicken and gravy are already inside the 750g and the model
// added them on top instead. The fix mirrors the lesson camera-nutrition.ts
// already encodes for label panels: the model classifies, the app computes.
// The model still returns chicken and gravy as their own editable items (so
// a user can bump "6 pieces" to 8 without touching anything else) — it just
// flags them as `is_stated_component`, and this module subtracts them from
// the user's stated total to find what's left for the base dish, rather
// than trusting the model's own arithmetic.

export type StatedTotal = { grams: number; anchorHint: string } | null

export type ResolvedChatItem = {
  name: string
  portion_desc: string
  grams: number
  confidence: 'low' | 'medium' | 'high'
  kcal_per_100g: number
  protein_g_per_100g: number
  carbs_g_per_100g: number
  fat_g_per_100g: number
  /** True when the raw macros were implausible and got clamped. */
  clamped: boolean
}

export type RebalanceResult = {
  items: ResolvedChatItem[]
  assumptions: string
  mismatch: {
    stated_grams: number
    parsed_sum_grams: number
    action: 'rebalanced' | 'scaled_down'
  } | null
}

const WEIGHT_RE = /(\d+(?:\.\d+)?)\s*(kgs?|kilo(?:gram)?s?|g|gm|gms|grams?)\b/gi

/** Hindi/Hinglish fractional-kg phrasings the portion table doesn't cover. */
const WORD_FORM_WEIGHTS: [RegExp, number][] = [
  [/\bpauna\s*kgs?\b/i, 750],
  [/\baadha\s*kgs?\b|\bhalf\s*(?:a\s*)?kgs?\b/i, 500],
  [/\bdedh\s*kgs?\b/i, 1500],
  [/\bpaav\s*kgs?\b|\bquarter\s*(?:a\s*)?kgs?\b/i, 250],
]

const STOP_WORDS_RE = /,|\b(and|aur|which|that|contain|contains|contained|containing|consist|consists|consisted|consisting|comprise|comprises|comprised|comprising|made|with|along)\b/i

function extractAnchorHint(after: string): string {
  const stripped = after.trim().replace(/^(of|ka|ki|ke)\s+/i, '')
  const stop = STOP_WORDS_RE.exec(stripped)
  const head = stop ? stripped.slice(0, stop.index) : stripped
  return head.trim().split(/\s+/).filter(Boolean).slice(0, 6).join(' ')
}

/**
 * Find a single user-stated total weight for a dish ("750g biryani", "aadha
 * kg biryani"). Deliberately conservative: a message naming more than one
 * distinct weight returns null rather than guess which one is "the" total —
 * doing nothing is safer than rebalancing against the wrong number.
 */
export function parseStatedTotal(message: string): StatedTotal {
  const matches: { grams: number; index: number; length: number }[] = []

  for (const m of message.matchAll(WEIGHT_RE)) {
    const value = parseFloat(m[1])
    const unit = m[2].toLowerCase()
    const grams = unit.startsWith('kg') || unit.startsWith('kilo') ? value * 1000 : value
    if (grams > 0) matches.push({ grams, index: m.index ?? 0, length: m[0].length })
  }
  for (const [re, grams] of WORD_FORM_WEIGHTS) {
    const m = re.exec(message)
    if (m) matches.push({ grams, index: m.index, length: m[0].length })
  }

  if (matches.length !== 1) return null

  const { grams, index, length } = matches[0]
  const anchorHint = extractAnchorHint(message.slice(index + length))
  if (!anchorHint) return null

  return { grams, anchorHint }
}

function tokenize(s: string): string[] {
  return foldSpelling(s.toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean)
}

/** Index of the `rest` entry whose name shares the most tokens with the
 *  anchor hint — the dish the user's stated weight actually describes. */
function pickAnchorIndex(rest: { name: string }[], anchorHint: string): number {
  const hintTokens = new Set(tokenize(anchorHint))
  let bestIdx = 0
  let bestScore = -1
  rest.forEach((item, i) => {
    const score = tokenize(item.name).filter((t) => hintTokens.has(t)).length
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  })
  return bestIdx
}

function appendNote(existing: string, note: string): string {
  const trimmed = existing.trim()
  return trimmed ? `${trimmed} ${note}` : note
}

function resolveAll(rawItems: ChatItem[]): ResolvedChatItem[] {
  return rawItems.map((item) => {
    const n = resolveChatItemNutrition(item)
    return {
      name: item.name,
      portion_desc: item.portion_desc,
      grams: Math.max(0, num(item.grams) ?? 0),
      confidence: n.plausible ? (item.confidence ?? 'medium') : 'low',
      kcal_per_100g: n.kcal_per_100g,
      protein_g_per_100g: n.protein_g_per_100g,
      carbs_g_per_100g: n.carbs_g_per_100g,
      fat_g_per_100g: n.fat_g_per_100g,
      clamped: !n.plausible,
    }
  })
}

/** Proportionally scale every item so they sum to the stated total, and mark
 *  the whole result low-confidence — used when there's no single base item
 *  to subtract components from (everything is a "component"), or the
 *  components alone already meet or exceed what the user said they ate. */
function scaleDown(resolved: ResolvedChatItem[], statedGrams: number, originalSum: number, assumptions: string): RebalanceResult {
  if (originalSum <= 0) {
    return { items: resolved, assumptions, mismatch: null }
  }
  const scale = statedGrams / originalSum
  const scaled = resolved.map((it) => ({ ...it, grams: Math.max(1, Math.round(it.grams * scale)), confidence: 'low' as const }))
  return {
    items: scaled,
    assumptions: appendNote(
      assumptions,
      `You said ${Math.round(statedGrams)}g total — the parts alone added up to more than that, so every item was scaled down to fit. Check the sliders.`
    ),
    mismatch: { stated_grams: statedGrams, parsed_sum_grams: originalSum, action: 'scaled_down' },
  }
}

/**
 * The arithmetic the model must never be trusted to do itself (same lesson
 * as resolveNutrition's label-panel scaling): subtract explicitly-quantified
 * components from a user-stated total and assign the remainder to the base
 * item, so components stay independently editable and the total never
 * silently exceeds what the user said they ate.
 */
export function rebalanceChatItems(rawItems: ChatItem[], stated: StatedTotal, modelAssumptions: string): RebalanceResult {
  const resolved = resolveAll(rawItems)

  if (!stated) {
    return { items: resolved, assumptions: modelAssumptions, mismatch: null }
  }

  const rest = rawItems
    .map((raw, i) => ({ raw, resolved: resolved[i] }))
    .filter(({ raw }) => raw.is_stated_component !== true)
  const components = rawItems
    .map((raw, i) => ({ raw, resolved: resolved[i] }))
    .filter(({ raw }) => raw.is_stated_component === true)

  const originalSum = resolved.reduce((sum, it) => sum + it.grams, 0)

  if (rest.length === 0) {
    // Every item claims to be a component — there's nothing to subtract
    // FROM, so subtraction can't safely correct this. Scale everything.
    return scaleDown(resolved, stated.grams, originalSum, modelAssumptions)
  }

  const sumComponents = components.reduce((sum, c) => sum + c.resolved.grams, 0)
  if (sumComponents >= stated.grams) {
    // Bad parse — the components alone already meet or exceed the stated
    // total, so subtraction would drive the base to zero or negative.
    return scaleDown(resolved, stated.grams, originalSum, modelAssumptions)
  }

  const anchorIdx = pickAnchorIndex(rest.map((r) => r.raw), stated.anchorHint)
  const anchor = rest[anchorIdx]
  const floor = Math.max(50, stated.grams * 0.15)
  const newAnchorGrams = Math.max(floor, stated.grams - sumComponents)

  const anchorPos = rawItems.indexOf(anchor.raw)
  const rebalanced = resolved.map((it, i) => (i === anchorPos ? { ...it, grams: newAnchorGrams } : it))

  if (Math.abs(originalSum - stated.grams) <= 1) {
    // The model's own numbers already summed to what the user said — nothing to correct.
    return { items: resolved, assumptions: modelAssumptions, mismatch: null }
  }

  return {
    items: rebalanced,
    assumptions: appendNote(
      modelAssumptions,
      `Read this as one ${Math.round(stated.grams)}g dish — the rest of it absorbs what wasn't separately counted.`
    ),
    mismatch: { stated_grams: stated.grams, parsed_sum_grams: originalSum, action: 'rebalanced' },
  }
}

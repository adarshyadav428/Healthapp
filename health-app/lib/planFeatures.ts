/**
 * The single source of truth for the free-vs-Pro feature lists.
 *
 * These lists were hand-written at five call sites and had drifted apart — the
 * landing page claimed "Full nutrition history (30+ days)" for Pro while the
 * actual enforced free window is the last 7 days (lib/backfill.ts), /upgrade
 * said "beyond the last 7 days", and /pricing listed things as Pro that aren't
 * gated at all. The landing page's free list is a public commitment
 * (CLAUDE.md), so it is reproduced here verbatim — this module only relocates
 * it — and tests/planFeatures.test.ts pins the surfaces together.
 *
 * The lists now deliberately name no day count. The free history window varies
 * by signup date — newer cohorts get a shorter window than existing users (see
 * lib/freeTier.ts for the enforced, per-cohort value) — so any fixed number in
 * the copy would be wrong for someone. "Full history — every day you’ve ever
 * logged" is the Pro claim, true for every cohort forever.
 *
 * `/pricing` now reads from this module too: an earlier PR left it on its own
 * hand-written arrays, and that ended in C2. Every plan-list surface — the
 * landing page, /pricing, /upgrade and the post-log interstitial — renders
 * from here.
 *
 * The enforced history window is NOT here — it varies by signup cohort and
 * lives in lib/freeTier.ts. This module is copy only.
 */

/**
 * Free tier — verbatim from app/page.tsx. Substance is a public claim; do not
 * change what's on this list without changing the tier itself.
 */
export const FREE_FEATURES = [
  'Full calorie & macro tracking',
  'Weight tracking',
  'Exercise logging',
  'Barcode scanning',
  '3 free AI scans when you confirm your email',
  'Calorie + macro goals',
  '850+ Indian foods database',
] as const

/** Pro tier — the reconciled list, naming no day count (seeded from app/upgrade/page.tsx). */
export const PRO_FEATURES = [
  'Unlimited AI photo & chat logging',
  'Weekly AI recap — your week summarised every Sunday',
  'Full history — every day you’ve ever logged',
  'Custom foods & recipes — log your home-cooked dishes',
  'Advanced trends — full weight history, macro breakdown charts',
  'Priority email support',
  'No ads, ever',
] as const

/**
 * The three Pro features the post-log paywall interstitial shows — a strict
 * subset of PRO_FEATURES so the interstitial can never contradict the full list.
 */
export const PRO_FEATURES_INTERSTITIAL = [
  'Full history — every day you’ve ever logged',
  'Unlimited AI photo & chat logging',
  'Custom foods & recipes — log your home-cooked dishes',
] as const

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
 * `/pricing` is deliberately left on its own hand-written lists for now; only
 * the landing page, /upgrade and the post-log interstitial read from here.
 */

/** The enforced free history window, in days (see lib/backfill.ts). */
export const FREE_HISTORY_DAYS = 7

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

/** Pro tier — the 7-day-truthful list (seeded from app/upgrade/page.tsx). */
export const PRO_FEATURES = [
  'Unlimited AI photo & chat logging',
  'Weekly AI recap — your week summarised every Sunday',
  `Full history — beyond the last ${FREE_HISTORY_DAYS} days`,
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
  `Full history — beyond the last ${FREE_HISTORY_DAYS} days`,
  'Unlimited AI photo & chat logging',
  'Custom foods & recipes — log your home-cooked dishes',
] as const

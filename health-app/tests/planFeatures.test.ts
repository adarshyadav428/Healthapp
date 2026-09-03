/**
 * The free-vs-Pro feature lists.
 *
 * Five hand-written copies of these lists had drifted apart — the landing page
 * claimed Pro gave "30+ days" of history while the enforced free window is 7
 * days (lib/backfill.ts), a regression of a fix marked closed a month earlier.
 * lib/planFeatures.ts is now the source of truth for the landing page,
 * /pricing, /upgrade and the post-log interstitial; this pins them together so
 * a fourth audit isn't needed to catch a third drift.
 *
 * The lists now name no day count at all: the free history window varies by
 * signup date (lib/freeTier.ts), so any fixed number would be wrong for some
 * cohort. The Pro claim is "Full history — every day you've ever logged".
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'
import {
  FREE_FEATURES,
  PRO_FEATURES,
  PRO_FEATURES_INTERSTITIAL,
} from '../lib/planFeatures'

const ROOT = join(__dirname, '..')
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8')

describe('lib/planFeatures invariants', () => {
  it('this module names no day count (the window lives in lib/freeTier.ts)', () => {
    expect(read('lib', 'planFeatures.ts')).not.toMatch(/FREE_HISTORY_DAYS/)
  })

  it('PRO_FEATURES claims full history and names no day count', () => {
    expect(PRO_FEATURES.some((f) => /full history/i.test(f))).toBe(true)
    for (const f of [...PRO_FEATURES, ...PRO_FEATURES_INTERSTITIAL]) {
      expect(f).not.toMatch(/\b\d+\+?\s*days?\b/i)
    }
  })

  it('the interstitial list is a strict subset of PRO_FEATURES', () => {
    for (const f of PRO_FEATURES_INTERSTITIAL) expect(PRO_FEATURES).toContain(f)
    expect(PRO_FEATURES_INTERSTITIAL.length).toBeLessThan(PRO_FEATURES.length)
  })

  it('FREE_FEATURES keeps the public "3 free AI scans" claim', () => {
    expect(FREE_FEATURES.some((f) => /3 free AI scans/.test(f))).toBe(true)
  })
})

describe('the surfaces render from the shared module', () => {
  it.each([
    ['app/page.tsx', ['app', 'page.tsx']],
    ['app/pricing/page.tsx', ['app', 'pricing', 'page.tsx']],
    ['app/upgrade/page.tsx', ['app', 'upgrade', 'page.tsx']],
    ['components/milestones/LogMilestones.tsx', ['components', 'milestones', 'LogMilestones.tsx']],
  ])('%s imports from lib/planFeatures', (_label, path) => {
    expect(read(...path)).toMatch(/from ['"].*lib\/planFeatures['"]/)
  })

  it('the landing page no longer claims "30+ days" for Pro', () => {
    expect(read('app', 'page.tsx')).not.toMatch(/30\+?\s*days/i)
  })
})

/**
 * No user-facing string may hardcode a per-cohort free-tier number.
 *
 * `lib/freeTier.ts` keys every limit on signup date: pre-cutoff accounts get 7
 * history days and 30 weight rows, post-cutoff accounts get 5 and 14. The
 * *enforcement* was threaded correctly through both — but the sentences
 * explaining each gate still said 7 and 30, so a post-cutoff user was served 5
 * days and told 7, served 14 weigh-ins and told 30, at the exact moment they
 * hit the wall. The cohort-neutral-copy pass (commit 65c0ad8) missed these two
 * files; its own message says "P-A now names the cap in the UI so it sells",
 * while the named cap still read 30. Found by the 2026-09-03 audit (P1-3).
 *
 * The rule is not "never show a number" — `DayDiary` and `WeightClient` now
 * show the account's REAL number, passed down as a prop. It is "never write one
 * as a literal in copy", because a literal cannot vary by cohort.
 */
describe('free-tier copy names no hardcoded cohort number', () => {
  const ROOTS = ['app', 'components', 'lib']
  const BANNED: [RegExp, string][] = [
    [/last 7 days in full/i, 'the free history window is 5 days for post-cutoff accounts'],
    [/last 30 weigh-ins/i, 'the free weight cap is 14 rows for post-cutoff accounts'],
    [/Last 7 days only/i, 'cohort-varying; say "Recent days only"'],
    [/history beyond 7 days/i, 'cohort-varying; say "your full logging history"'],
    [/beyond the last 7 days/i, 'cohort-varying'],
  ]

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name)
      if (entry.isDirectory()) walk(p, out)
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p)
    }
    return out
  }

  const files = ROOTS.flatMap((r) => walk(join(__dirname, '..', r)))

  /**
   * Comments are stripped before scanning. Several files legitimately *quote*
   * the old copy while explaining why it was wrong — including this rule's own
   * source module — and a guard that fired on its own rationale would just get
   * an allow-list bolted onto it until it meant nothing. Only shipped strings count.
   */
  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  it.each(BANNED)('no shipped string contains %s (%s)', (pattern, why) => {
    const offenders = files
      .filter((f) => pattern.test(stripComments(readFileSync(f, 'utf8'))))
      // /studio is an internal, deliberately unlinked token/art preview; its
      // before/after strings are sample art, not a live gate.
      .filter((f) => !f.endsWith('StudioClient.tsx'))
      .map((f) => f.split(`health-app${sep}`).pop())
    expect(offenders, `${String(pattern)} — ${why}`).toEqual([])
  })
})

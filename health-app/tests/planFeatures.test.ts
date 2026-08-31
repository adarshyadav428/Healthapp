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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

/**
 * The free-vs-Pro feature lists.
 *
 * Five hand-written copies of these lists had drifted apart — the landing page
 * claimed Pro gave "30+ days" of history while the enforced free window is 7
 * days (lib/backfill.ts), a regression of a fix marked closed a month earlier.
 * lib/planFeatures.ts is now the source of truth for the landing page,
 * /upgrade and the post-log interstitial; this pins them together so a fourth
 * audit isn't needed to catch a third drift.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  FREE_FEATURES,
  PRO_FEATURES,
  PRO_FEATURES_INTERSTITIAL,
  FREE_HISTORY_DAYS,
} from '../lib/planFeatures'

const ROOT = join(__dirname, '..')
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8')

describe('lib/planFeatures invariants', () => {
  it('the enforced free window is 7 days', () => {
    expect(FREE_HISTORY_DAYS).toBe(7)
  })

  it('PRO_FEATURES states the 7-day boundary and never a 30-day one', () => {
    expect(PRO_FEATURES.some((f) => /beyond the last 7 days/.test(f))).toBe(true)
    for (const f of PRO_FEATURES) expect(f).not.toMatch(/\b30\+?\s*days?\b/i)
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
    ['app/upgrade/page.tsx', ['app', 'upgrade', 'page.tsx']],
    ['components/milestones/LogMilestones.tsx', ['components', 'milestones', 'LogMilestones.tsx']],
  ])('%s imports from lib/planFeatures', (_label, path) => {
    expect(read(...path)).toMatch(/from ['"].*lib\/planFeatures['"]/)
  })

  it('the landing page no longer claims "30+ days" for Pro', () => {
    expect(read('app', 'page.tsx')).not.toMatch(/30\+?\s*days/i)
  })
})

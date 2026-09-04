/**
 * Two invariants that live in the seam between a Server Component, a route and
 * the client it hands props to — where neither a unit test nor a route test
 * looks, and where the 2026-09-03 audit found both of these.
 *
 *   1. A free client must never RECEIVE data a padlock is merely covering.
 *      `WeeklyRecapCard` renders a `ProLock` for a free account, which looks
 *      like a gate and is not: the row was built unconditionally and shipped in
 *      the RSC flight payload regardless (P2-1).
 *   2. A capped candidate pool must be ORDERED. Postgres applies LIMIT before
 *      any sort, so an unordered `.limit(400)` is an arbitrary 400 rows —
 *      which drifts as the table grows and can omit the measured tier entirely
 *      (P2-2).
 *
 * Asserted against source. Both defects are about the *shape* of a query or a
 * prop hand-off, and both files would need a Supabase and an RSC harness this
 * repo does not have to reach any other way. Deliberately narrow.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')
const readRaw = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8')

/**
 * Comments stripped before scanning — including JSX `{/* … *​/}`, which is a
 * block comment in braces.
 *
 * Not optional tidiness. Both fixes below explain themselves by quoting the
 * defect they replaced ("there was no `.order()` in the file", `Not "unlimited
 * food logging"`), so a guard reading raw source counts its own rationale as a
 * violation. That happened twice while writing this file, and once before it in
 * `planFeatures.test.ts`. The alternative — an allow-list of files — erodes
 * until the guard means nothing. Only shipped code counts.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const read = (...p: string[]) => stripComments(readRaw(...p))

describe('the weekly recap is gated server-side, not in CSS', () => {
  const page = read('app', 'dashboard', 'page.tsx')

  it('never builds the recap for a free account', () => {
    // The bug: `const recapRow = recapResult.data`, unconditionally.
    expect(page).toMatch(/const recapRow = isPro \? recapResult\.data : null/)
  })

  it('decides isPro before it decides the recap', () => {
    // Ordering matters or the gate reads `undefined` and passes everything.
    const proAt = page.indexOf('const isPro =')
    const recapAt = page.indexOf('const recapRow =')
    expect(proAt).toBeGreaterThan(-1)
    expect(recapAt).toBeGreaterThan(proAt)
  })

  it('still passes the flag so the card can render its ProLock', () => {
    // The padlock is not the gate, but it is still the empty state.
    expect(page).toMatch(/isPro=\{isPro\}/)
  })
})

describe('the suggestion candidate pool is ordered and measured-first', () => {
  const route = read('app', 'api', 'foods', 'suggest', 'route.ts')

  it('orders every capped read', () => {
    // The finding was literally `grep -c "\.order(" → 0` under a comment
    // claiming the pool was ordered. Both reads are capped, so both must sort.
    const orders = route.match(/\.order\(/g) ?? []
    const limits = route.match(/\.limit\(/g) ?? []
    expect(limits.length).toBeGreaterThan(0)
    expect(orders.length).toBe(limits.length)
  })

  it('reads the measured tier separately from curated', () => {
    // One query cannot express "measured first": PostgREST has no ORDER BY
    // CASE, and `source` sorts alphabetically, which puts curated above ifct.
    expect(route).toContain("eq('source', 'curated')")
    expect(route).toContain("not('source', 'in', NON_MEASURED)")
  })

  it('defines the tiers by exclusion, not by listing source names', () => {
    // A source added to the table and not to a hardcoded allow-list here would
    // vanish from every suggestion — a worse bug than the one being fixed.
    expect(route).toMatch(/NON_MEASURED = '\("curated","estimate"\)'/)
  })

  it('keeps per-user AI estimates out of the shared pool', () => {
    expect(route).toContain('estimate')
    expect(route).not.toMatch(/\.eq\('source', 'estimate'\)/)
  })

  it('does not swallow a failed read', () => {
    // `const { data: foods } = await …` returns undefined on error, and an
    // unreadable catalogue is then indistinguishable from an empty one — the
    // failure mode this codebase keeps re-learning.
    expect(route).toMatch(/if \(measuredRes\.error \|\| curatedRes\.error\)/)
    expect(route).toMatch(/status: 500/)
  })
})

describe('the free tier is described the way it is enforced', () => {
  it('the refunds page does not sell food logging as a Pro feature', () => {
    // This is the page a payment aggregator reads to understand what is being
    // sold, and "free is never capped on logging" is a hard rule (P2-6).
    const refunds = read('app', 'refunds', 'page.tsx')
    expect(refunds).not.toMatch(/unlimited food\s+logging/)
    // \s+ because JSX prose wraps: the sentence spans a line break in source.
    expect(refunds).toMatch(/free\s+and never capped/)
  })

  it('no surface promises a daily suggestion cap the route does not keep', () => {
    // The cap is per-response, with no daily counter anywhere — dismissing and
    // refreshing yields more. The copy overstated the restriction (P2-12).
    const route = read('app', 'api', 'foods', 'suggest', 'route.ts')
    expect(route).not.toMatch(/suggestions_today|suggestionsToday/)
    for (const file of [
      join('app', 'upgrade', 'page.tsx'),
      join('components', 'log', 'FoodLanding.tsx'),
    ]) {
      expect(read(file), `${file} claims a daily cap`).not.toMatch(/suggestions a day/i)
    }
  })
})

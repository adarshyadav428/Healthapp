/**
 * The ProLock primitive and its call sites.
 *
 * Before this component, every "this is Pro" affordance was hand-rolled — three
 * inline implementations that had drifted, and thirteen surfaces that showed a
 * free user nothing at all where a Pro feature would be. This pins two things:
 *
 *   1. Every `reason` ProLock can be handed resolves to a real REASON_COPY entry
 *      on /upgrade, so a lock can never link to a bannerless paywall.
 *   2. Every `track` PaywallSource passed at a call site is a real union member,
 *      and the surfaces that used to render nothing now render a ProLock.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { PaywallSource } from '../lib/posthog/events'

const ROOT = join(__dirname, '..')
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8')

const norm = (s: string) => s.replace(/\r\n/g, '\n')
const proLockSrc = norm(read('components', 'ui', 'ProLock.tsx'))
const upgradeSrc = norm(read('app', 'upgrade', 'page.tsx'))
const eventsSrc = norm(read('lib', 'posthog', 'events.ts'))

/** The keys of REASON_COPY in app/upgrade/page.tsx. */
function reasonCopyKeys(): string[] {
  const block = upgradeSrc.match(/const REASON_COPY[^{]*\{([\s\S]*?)\n\}/)
  expect(block, 'REASON_COPY object not found').toBeTruthy()
  return [...block![1].matchAll(/^\s*([a-z_]+):\s*\{/gm)].map((m) => m[1])
}

/** The members of the PaywallSource union in lib/posthog/events.ts. */
function paywallSourceMembers(): string[] {
  const block = eventsSrc.match(/export type PaywallSource =([\s\S]*?)\nexport /)
  expect(block, 'PaywallSource union not found').toBeTruthy()
  return [...block![1].matchAll(/\|\s*'([a-z_]+)'/g)].map((m) => m[1])
}

describe('ProLock reasons resolve to /upgrade copy', () => {
  const keys = reasonCopyKeys()

  it('every ProLockReason is a REASON_COPY key', () => {
    const union = proLockSrc.match(/export type ProLockReason =([\s\S]*?)\nfunction /)
    expect(union).toBeTruthy()
    const reasons = [...union![1].matchAll(/\|\s*'([a-z_]+)'/g)].map((m) => m[1])
    expect(reasons.length).toBeGreaterThanOrEqual(4)
    for (const r of reasons) expect(keys, `missing REASON_COPY.${r}`).toContain(r)
  })

  it('the wrapped locked card has somewhere to land', () => {
    expect(keys).toContain('wrapped')
    expect(read('app', 'wrapped', 'page.tsx')).toMatch(/upgrade\?reason=wrapped/)
  })
})

describe('call-site tracks are real PaywallSources', () => {
  const members = paywallSourceMembers()

  it.each([
    ['components/dashboard/WeeklyRecapCard.tsx', ['components', 'dashboard', 'WeeklyRecapCard.tsx']],
    ['components/log/FoodLanding.tsx', ['components', 'log', 'FoodLanding.tsx']],
    ['components/log/CreateFoodModal.tsx', ['components', 'log', 'CreateFoodModal.tsx']],
    ['app/recipes/page.tsx', ['app', 'recipes', 'page.tsx']],
  ])('%s passes a valid track= to ProLock', (_label, path) => {
    const src = read(...path)
    for (const m of src.matchAll(/track=["']([a-z_]+)["']/g)) {
      expect(members, `unknown PaywallSource "${m[1]}"`).toContain(m[1] as PaywallSource)
    }
  })

  it('recap_card and meal_suggestions are declared', () => {
    expect(members).toContain('recap_card')
    expect(members).toContain('meal_suggestions')
  })
})

describe('surfaces that used to render nothing now show a lock', () => {
  it('the weekly recap card no longer returns null for free users', () => {
    const src = read('components', 'dashboard', 'WeeklyRecapCard.tsx')
    expect(src).not.toMatch(/if \(!isPro\) return null/)
    expect(src).toMatch(/ProLock\.Card/)
  })

  it('the /log back chevron locks instead of navigating at the boundary', () => {
    expect(read('components', 'log', 'FoodHeader.tsx')).toMatch(/prevDayLocked/)
    expect(read('components', 'log', 'SwipeDayNav.tsx')).toMatch(/prevDayLocked/)
  })

  it('the day diary distinguishes "beyond free window" from "nothing logged"', () => {
    const src = read('components', 'progress', 'DayDiary.tsx')
    expect(src).toMatch(/beyondFreeWindow/)
    expect(src).toMatch(/ProLock\.Card/)
  })

  it('the recipe builder handles the 402 instead of throwing a raw error', () => {
    expect(read('components', 'recipes', 'RecipeBuilder.tsx')).toMatch(/res\.status === 402/)
  })
})


/**
 * The /recipes crash (P1, prod 2026-09-06): `app/recipes/page.tsx` is a Server
 * Component that rendered `<ProLock.Card>`. Dotting into a `'use client'`
 * module from the server hits React's client-reference proxy, which throws
 * during the RSC render — so the page died with "An error occurred in the
 * Server Components render". It only broke free users, because the locked
 * branch (`{!isPro && ...}`) is the one that dots in; Pro never evaluated it.
 * `app/deficit/page.tsx` carried the same latent bug, masked only by the 3-day
 * free grace window in `deficitAccess`.
 *
 * Server files must import the flat `ProLockCard` / `ProLockChip` exports.
 */
describe('no Server Component dots into the ProLock client module', () => {
  const dirs = ['app', 'components']
  const files: string[] = []

  const walk = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(rel)
      else if (entry.name.endsWith('.tsx')) files.push(rel)
    }
  }
  for (const d of dirs) walk(d)

  const importsProLock = (src: string) => /from\s+['"][^'"]*\/ProLock['"]/.test(src)
  const isClient = (src: string) => /^\s*['"]use client['"]/.test(src)

  it('finds the call sites it means to guard', () => {
    expect(files.length).toBeGreaterThan(20)
    expect(files.filter((f) => importsProLock(norm(read(f))))).not.toHaveLength(0)
  })

  it.each(['app/recipes/page.tsx', 'app/deficit/page.tsx'])(
    '%s imports ProLockCard flat, never ProLock.Card',
    (path) => {
      const src = norm(read(path))
      expect(isClient(src), `${path} is expected to be a Server Component`).toBe(false)
      expect(src).toMatch(/import \{ ProLockCard \}/)
      expect(src).not.toMatch(/ProLock\./)
    },
  )

  it('every server file importing ProLock uses the flat exports', () => {
    const offenders = files.filter((f) => {
      const src = norm(read(f))
      return !isClient(src) && importsProLock(src) && /ProLock\./.test(src)
    })
    expect(offenders, `Server Components cannot dot into ProLock: ${offenders.join(', ')}`).toEqual(
      [],
    )
  })

  it('client call sites may still use the ProLock.* object', () => {
    const clientDotters = files.filter((f) => {
      const src = norm(read(f))
      return isClient(src) && /ProLock\./.test(src)
    })
    expect(clientDotters.length).toBeGreaterThan(0)
  })
})

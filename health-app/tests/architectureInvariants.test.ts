/**
 * The four structural invariants that make UI work safe.
 *
 * docs/refactor-safety-contract.md claims that a change confined to
 * components/ and page-level JSX cannot alter what gets stored or computed.
 * That claim is true, and until now it was only *prose* — the contract asked a
 * reader to re-run two greps by hand, and the numbers in it went stale twice
 * without the invariant ever actually breaking, which is worse than a wrong
 * number because it invites the conclusion that the rule lapsed.
 *
 * The failure mode this guards is specific: someone restyling a component adds
 * one `.insert()` or one direct table read, the whole safety contract silently
 * stops holding, every gate still passes, and nothing says so. These are cheap
 * assertions against a claim the entire refactor story rests on.
 *
 * Assertions are text-over-source in the house style (see proLock.test.ts,
 * serverGating.test.ts) rather than AST parsing: there is no parser dependency
 * here, and every rule below is a literal string or a shallow regex.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

/**
 * Strip comments before matching. Borrowed from serverGating.test.ts for the
 * same reason it exists there: a comment explaining why a rule exists will
 * happily satisfy the regex meant to catch the rule being broken.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n]*?\/\/.*$/gm, (line) => {
    // Keep the code before a trailing `//`, drop the comment itself.
    const i = line.indexOf('//')
    return i === -1 ? line : line.slice(0, i)
  })

/** Every file under `dirs` with one of `exts`, repo-relative, recursively. */
function walk(dirs: string[], exts: string[]): string[] {
  const files: string[] = []
  const visit = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`
      if (entry.isDirectory()) visit(rel)
      else if (exts.some((e) => entry.name.endsWith(e))) files.push(rel)
    }
  }
  for (const d of dirs) visit(d)
  return files
}

const CLIENT_FILES = walk(['components', 'hooks'], ['.ts', '.tsx'])
const API_FILES = walk(['app/api'], ['.ts'])
const PAGE_FILES = walk(['app'], ['page.tsx'])

describe('every database write lives in app/api', () => {
  it('finds the trees it means to guard', () => {
    // A walk that silently returns nothing would make every assertion below
    // pass for the wrong reason. This is the load-bearing half.
    expect(CLIENT_FILES.length).toBeGreaterThan(50)
    expect(API_FILES.length).toBeGreaterThan(40)
  })

  it('app/api still holds the writes', () => {
    const writers = API_FILES.filter((f) => /\.(insert|update|upsert|delete)\(/.test(read(f)))
    // ~48 route files write today. If this collapses, the walk broke or the
    // architecture moved — either way the next assertion proves nothing.
    expect(writers.length).toBeGreaterThan(30)
  })

  it('no component or hook writes to the database', () => {
    const offenders = CLIENT_FILES.filter((f) => {
      const src = stripComments(read(f))
      // `.delete(` also matches URLSearchParams.delete(), which is not a
      // database write — there are two legitimate uses (BottomNav.tsx,
      // FoodLanding.tsx) clearing a query param. Match on the receiver rather
      // than filtering the word "searchParams" out of the whole file, so a
      // real `.delete(` in a file that happens to also touch search params is
      // still caught.
      const writes = [...src.matchAll(/(\w+)\s*\.\s*(insert|update|upsert|delete)\(/g)]
      return writes.some(([, receiver]) => !/params$/i.test(receiver))
    })
    expect(offenders).toEqual([])
  })
})

describe('components read gated data through the API, not Supabase directly', () => {
  // The two exemptions, each with the reason it is safe:
  //   useUser        — reads the caller's own profiles row; not tier-gated.
  //   useSubscription — reads the caller's own subscriptions row, which has
  //                     exactly one RLS policy (subs_select) and no write
  //                     policy at all, so reading it grants nothing.
  // A third entry is not a thing to add lightly: /api/logs and
  // /api/exercise/logs clamp free-tier history server-side, and a component
  // going straight to PostgREST walks around that clamp.
  const EXEMPT = ['hooks/useUser.ts', 'hooks/useSubscription.ts']

  it('no new direct table access appears in components or hooks', () => {
    const offenders = CLIENT_FILES.filter((f) => {
      if (EXEMPT.includes(f)) return false
      const src = stripComments(read(f))
      // `.from(` on a supabase client. Array.from is a static method on a
      // capitalised receiver, so exclude that shape rather than the file.
      return [...src.matchAll(/(\w+)\s*\.\s*from\(/g)].some(([, r]) => !/^[A-Z]/.test(r))
    })
    expect(offenders).toEqual([])
  })

  it('the exemptions still exist and still read what they claim', () => {
    // An allowlist naming a deleted file quietly grows the surface it guards.
    expect(read('hooks/useUser.ts')).toContain("from('profiles')")
    expect(read('hooks/useSubscription.ts')).toContain("from('subscriptions')")
  })
})

describe('every authenticated page gates on onboarding', () => {
  // The onboarding check is deliberately NOT in middleware — each protected
  // page's Server Component does its own. That means a new page inherits
  // nothing, and forgetting the line is invisible: the page renders, then
  // narrates a plan against a profile that has no height in it.
  //
  // /welcome and /wrapped both went without one for as long as they existed
  // (found 2026-09-06); /upgrade is a public route, so paying before finishing
  // the wizard reaches /welcome with no profile. Both now carry the guard,
  // which is why this rule has no allowlist. Do not add one — the exception is
  // how the rule stops being true.
  const authed = PAGE_FILES.filter((f) => read(f).includes('getAuthedUser('))

  it('finds the authenticated pages', () => {
    expect(authed.length).toBeGreaterThanOrEqual(11)
  })

  it.each([['app/welcome/page.tsx'], ['app/wrapped/page.tsx']])(
    '%s is one of them (it was missing its guard)',
    (page) => {
      expect(authed).toContain(page)
    }
  )

  it('every authenticated page redirects an un-onboarded user', () => {
    const offenders = authed.filter((f) => {
      // The one structural exception: the onboarding page itself carries the
      // inverse guard, sending an already-onboarded user away.
      if (f === 'app/onboarding/page.tsx') return !read(f).includes("redirect('/dashboard')")
      return !read(f).includes("redirect('/onboarding')")
    })
    expect(offenders).toEqual([])
  })
})

describe('the public route list matches the code', () => {
  // A route slipping into isPublic is how an authenticated surface quietly
  // becomes reachable signed-out. CLAUDE.md described this list as 7 entries
  // for a long time while the code had 10 — prose drifts, this will not.
  const EXPECTED_EXACT = [
    '/',
    '/privacy',
    '/terms',
    '/refunds',
    '/contact',
    '/pricing',
    '/delete-account',
    '/upgrade',
    '/studio',
  ]

  const middleware = read('middleware.ts')
  const isPublicLine = /const isPublic =([^\n]*)/.exec(middleware)?.[1] ?? ''

  it('finds the isPublic expression', () => {
    expect(isPublicLine, 'isPublic was renamed or reformatted').toBeTruthy()
  })

  it('exposes exactly the expected exact-match routes', () => {
    const found = [...isPublicLine.matchAll(/pathname === '([^']+)'/g)].map((m) => m[1])
    expect(found.sort()).toEqual([...EXPECTED_EXACT].sort())
  })

  it('exposes exactly one prefix route, /foods/', () => {
    const prefixes = [...isPublicLine.matchAll(/pathname\.startsWith\('([^']+)'\)/g)].map((m) => m[1])
    expect(prefixes).toEqual(['/foods/'])
  })
})

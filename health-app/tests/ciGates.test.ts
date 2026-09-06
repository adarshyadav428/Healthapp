/**
 * The CI workflow that runs the five gates.
 *
 * CLAUDE.md has required all five gates before a change is "done" since the
 * beginning, and for just as long nothing ran them: `main` has no branch
 * protection and merging a PR ships to Vercel immediately, so the only thing
 * between a broken commit and production was remembering. .github/workflows/
 * gates.yml is what makes the rule real — which means a gate silently
 * disappearing from it is exactly as bad as the rule never existing, and it
 * would be invisible in a diff nobody reads closely. This file makes that a
 * test failure.
 *
 * Read as text rather than parsed as YAML on purpose: this repo has no YAML
 * parser dependency, tests/reminderWiring.test.ts already reads a workflow the
 * same way (join(ROOT, '..', '.github', ...) — ROOT is health-app/, so '..'
 * reaches the repo root), and every property asserted here is a literal string.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')
const workflow = readFileSync(join(ROOT, '..', '.github', 'workflows', 'gates.yml'), 'utf8').replace(
  /\r\n/g,
  '\n'
)

/** The workflow body with `#` comment lines removed. */
const body = workflow
  .split('\n')
  .filter((l) => !/^\s*#/.test(l))
  .join('\n')

describe('the gates workflow runs every gate', () => {
  // Each entry is [human name, the exact command that must appear]. Adding a
  // sixth gate to CLAUDE.md means adding it here and to gates.yml.
  const GATES: [string, string][] = [
    ['tests', 'npm test'],
    ['typecheck', 'npx tsc --noEmit'],
    ['lint', 'npm run lint'],
    ['design tokens', 'npm run check:tokens'],
    ['build', 'npm run build'],
  ]

  it.each(GATES)('runs the %s gate', (_name, command) => {
    expect(body).toContain(`run: ${command}`)
  })

  it('installs with npm ci, not npm install', () => {
    // A gate run that resolves a different dependency tree than the lockfile
    // is not testing what was committed.
    expect(body).toContain('run: npm ci')
    expect(body).not.toMatch(/run:\s*npm install/)
  })
})

describe('the gates workflow is wired to actually block a merge', () => {
  it('is named `gates` — the context branch protection requires', () => {
    // Branch protection matches on the job id. Renaming the job without
    // updating the protection rule silently stops requiring the check, and
    // the PR page looks exactly the same.
    expect(body).toMatch(/^jobs:\n\s{2}gates:$/m)
  })

  it('runs on pull requests and on pushes to main', () => {
    expect(body).toMatch(/^on:\n/m)
    expect(body).toContain('pull_request:')
    expect(body).toMatch(/branches:\s*\[main\]/)
  })

  it('runs on a Node new enough for the dependency tree', () => {
    // Not cosmetic. @supabase/supabase-js 2.110 and its five sub-packages
    // declare engines.node >= 22, and package-lock.json was written by npm 11
    // (Node 24) — on Node 20's npm 10.8.2 the resolver disagrees and `npm ci`
    // fails outright before a single gate runs. Dropping this back below 22
    // breaks CI in a way whose error message points at the lockfile rather
    // than at the version.
    const version = /node-version: '(\d+)'/.exec(body)?.[1]
    expect(version, 'node-version pin not found in gates.yml').toBeTruthy()
    expect(Number(version)).toBeGreaterThanOrEqual(22)
  })

  it('runs every step from health-app/, not the repo root', () => {
    // The root is the TWA wrapper and has no meaningful package.json; every
    // npm command in this project belongs to health-app/.
    expect(body).toMatch(/defaults:\n\s+run:\n\s+working-directory: health-app/)
  })
})

describe('the gates workflow needs no secrets', () => {
  it('references no secrets at all', () => {
    // The repository is public and SUPABASE_SERVICE_ROLE_KEY bypasses RLS on
    // production. The build is only secretless because generateStaticParams
    // and getFoodPageUrls check hasAdminEnv() first — if a gate ever needs a
    // secret again, something started reaching the network at build time and
    // that is the thing to fix, not this assertion.
    expect(body).not.toContain('secrets.')
  })

  it('asks for read-only permissions', () => {
    expect(body).toMatch(/permissions:\n\s+contents: read/)
  })
})

describe('the build runs before the typecheck', () => {
  it('orders `npm run build` ahead of `npx tsc --noEmit`', () => {
    // next-env.d.ts is gitignored but listed in tsconfig.json's "include", so
    // on a fresh checkout there is nothing for tsc to read until next build
    // generates it. tsc first fails with a "file not found" that has nothing
    // to do with the change under test — the CI-side twin of the local
    // stale-.next/types trap. This is the one ordering that is not cosmetic.
    const build = body.indexOf('run: npm run build')
    const typecheck = body.indexOf('run: npx tsc --noEmit')
    expect(build).toBeGreaterThan(-1)
    expect(typecheck).toBeGreaterThan(-1)
    expect(build).toBeLessThan(typecheck)
  })
})

describe('the build really is secretless', () => {
  it('both build-time admin-client call sites check hasAdminEnv() first', () => {
    // These two functions are the only code that runs createAdminClient()
    // outside a request. Without the guard, `npm run build` throws in CI and
    // the whole gate is unrunnable — which is how it stayed unrun for so long.
    //
    // Scoped to each function's own body, not the whole file: getFood() in the
    // food page also calls createAdminClient() and correctly has no guard,
    // because it only ever runs for a request. A file-wide index comparison
    // reads that as a violation.
    const foodPage = readFileSync(join(ROOT, 'app', 'foods', '[slug]', 'page.tsx'), 'utf8')
    const sitemap = readFileSync(join(ROOT, 'app', 'sitemap.ts'), 'utf8')

    const CALL_SITES: [string, string, string][] = [
      ['app/foods/[slug]/page.tsx', foodPage, 'generateStaticParams'],
      ['app/sitemap.ts', sitemap, 'getFoodPageUrls'],
    ]

    for (const [name, src, fn] of CALL_SITES) {
      // From the declaration to the first line-start `}` — these are top-level
      // functions, so that is their closing brace.
      const start = src.indexOf(`function ${fn}(`)
      expect(start, `${name}: ${fn} was renamed or removed`).toBeGreaterThan(-1)
      const end = src.indexOf('\n}', start)
      const fnBody = src.slice(start, end)

      expect(fnBody, `${name}: ${fn} no longer guards on hasAdminEnv()`).toContain('hasAdminEnv()')
      expect(
        fnBody.indexOf('hasAdminEnv()'),
        `${name}: ${fn} calls createAdminClient() before checking hasAdminEnv()`
      ).toBeLessThan(fnBody.indexOf('createAdminClient()'))
    }
  })

  it('neither call site swallows a real Supabase failure', () => {
    // The guard is deliberately narrow: absent env only. A reachable Supabase
    // that errors, or a network failure mid-build, must still fail the Vercel
    // deploy loudly rather than quietly shipping a site with no food pages.
    const foodPage = readFileSync(join(ROOT, 'app', 'foods', '[slug]', 'page.tsx'), 'utf8')
    const sitemap = readFileSync(join(ROOT, 'app', 'sitemap.ts'), 'utf8')
    expect(foodPage).not.toContain('try {')
    expect(sitemap).not.toContain('try {')
  })
})

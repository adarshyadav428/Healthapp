/**
 * /api/streak/rescue — the P2-3 fix.
 *
 * This route authorizes an RLS-bypassing admin-client write: `streak_rescues`
 * has no user INSERT policy (migration 028), so RLS provides no backstop here
 * the way it does for every route using the user-scoped client. It used to
 * authorize that write with `getAuthedUser()` (lib/supabase/server.ts), which
 * — like `getApiUser()` — only verifies the JWT's signature and expiry
 * locally via `getClaims()`, with no live revocation check. That's the right
 * trade-off for a hot, low-stakes read path; it's the wrong one for the one
 * place the fast-auth-check argument doesn't hold, since nothing downstream
 * double-checks ownership the way RLS does elsewhere. Every other admin-
 * client route authorizing a sensitive write (camera/chat analyze,
 * razorpay/verify, account/delete, foods/custom, …) already uses the fully
 * revalidated `supabase.auth.getUser()`.
 *
 * `getAuthedUser()` is also built for Server Components/pages — it calls
 * `redirect()` on failure, which is meaningless inside a route handler — so
 * this fix is a correctness fix as well as an auth-strength one, not purely
 * cosmetic.
 *
 * tests/helpers/supabaseMock.ts backs both `auth.getUser()` and
 * `auth.getClaims()` with the same `user` option, so a black-box call
 * through the mock can't distinguish which one a route used — this is why
 * the choice is pinned by reading the route's own source, the same technique
 * tests/rlsPolicies.test.ts uses for SQL and tests/coachingWiring.test.ts
 * uses for wiring that isn't otherwise observable through a mock.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, PRO_SUB, type MockOptions } from './helpers/supabaseMock'

const ROUTE_SRC = readFileSync(
  join(__dirname, '..', 'app', 'api', 'streak', 'rescue', 'route.ts'),
  'utf8'
)

describe('app/api/streak/rescue/route.ts — auth path (source pin)', () => {
  it('authorizes via supabase.auth.getUser(), the fully revalidated path', () => {
    expect(ROUTE_SRC).toContain('supabase.auth.getUser()')
  })

  it('no longer imports getAuthedUser() — built for pages, redirects on failure, and only locally verifies the JWT', () => {
    // The doc comment above the handler legitimately names getAuthedUser() to
    // explain why it's the wrong tool here — the import line is the real pin.
    const importLine = ROUTE_SRC.match(/^import .* from '\.\.\/\.\.\/\.\.\/\.\.\/lib\/supabase\/server'$/m)?.[0]
    expect(importLine).toBeTruthy()
    expect(importLine).not.toContain('getAuthedUser')
  })
})

const createServerClient = vi.fn()
const createAdminClient = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  createAdminClient: () => createAdminClient(),
}))
vi.mock('../lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))

const { POST } = await import('../app/api/streak/rescue/route')

const RECENT_LOG = (daysAgo: number) => ({
  logged_at: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
})

function wire(options: { user?: MockOptions['user']; tables?: MockOptions['tables'] } = {}) {
  const server = createSupabaseMock({
    user: options.user === undefined ? { id: 'user-1', email: 'a@b.com' } : options.user,
    tables: { subscriptions: PRO_SUB, streak_rescues: { data: [] }, ...options.tables },
  })
  const admin = createSupabaseMock({
    tables: { streak_rescues: { insert: { data: null, error: null } } },
  })
  createServerClient.mockReturnValue(server.client)
  createAdminClient.mockReturnValue(admin.client)
  return { server, admin }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/streak/rescue — behaviour', () => {
  it('401s when there is no authenticated user', async () => {
    wire({ user: null })
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('finds and repairs a broken streak for a signed-in Pro user', async () => {
    // A single-day gap two days ago, with logs on either side.
    const { admin } = wire({
      tables: {
        food_logs: { data: [RECENT_LOG(1), RECENT_LOG(3), RECENT_LOG(4)] },
      },
    })
    const res = await POST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(admin.callsTo('streak_rescues').some((c) => c.operation === 'insert')).toBe(true)
  })
})

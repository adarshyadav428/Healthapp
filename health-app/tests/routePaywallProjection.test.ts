/**
 * GET /api/paywall/projection — the self-proof line on the 3rd-log interstitial.
 *
 * The load-bearing property: it reuses lib/goalProjection's honest gate, so it
 * returns `projection: null` (no line) when the user is off-track or has no
 * weigh-ins to measure — it must never assert a goal date to someone who has
 * just stepped on the scale and seen the opposite.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
}))

const { GET } = await import('../app/api/paywall/projection/route')

const USER = { id: 'user-1', email: 'a@b.com' }

function wire(tables: MockOptions['tables'], user: MockOptions['user'] = USER) {
  const mock = createSupabaseMock({ user, tables })
  createServerClient.mockReturnValue(mock.client)
  return mock
}

/** N daily weigh-ins ending today, `deltaPerDay` kg apart. */
function dailyWeighIns(n: number, startKg: number, deltaPerDay: number) {
  return Array.from({ length: n }, (_, i) => ({
    weight_kg: +(startKg + i * deltaPerDay).toFixed(1),
    measured_at: new Date(Date.now() - (n - 1 - i) * 86_400_000).toISOString(),
  }))
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/paywall/projection', () => {
  it('401s an unauthenticated request', async () => {
    wire({}, null)
    expect((await GET()).status).toBe(401)
  })

  it('returns null when there is no target weight', async () => {
    wire({
      profiles: { data: { current_weight_kg: 80, target_weight_kg: null, pace_kg_per_week: 0.5 } },
      weight_logs: { data: [] },
    })
    expect(await (await GET()).json()).toEqual({ projection: null })
  })

  it('returns a PLANNED projection when there are no weigh-ins but a pace', async () => {
    wire({
      profiles: { data: { current_weight_kg: 80, target_weight_kg: 72, pace_kg_per_week: 0.5 } },
      weight_logs: { data: [] },
    })
    const body = await (await GET()).json()
    expect(body.projection.kind).toBe('planned')
    expect(body.projection.headline).toMatch(/72 kg/)
  })

  it('returns null when the measured trend is off-track (gaining toward a loss goal)', async () => {
    wire({
      profiles: { data: { current_weight_kg: 80, target_weight_kg: 72, pace_kg_per_week: 0.5 } },
      // 15 daily weigh-ins trending UP while the goal is to lose.
      weight_logs: { data: dailyWeighIns(15, 80, 0.15) },
    })
    expect(await (await GET()).json()).toEqual({ projection: null })
  })

  it('returns a MEASURED projection when the trend points at the goal', async () => {
    wire({
      profiles: { data: { current_weight_kg: 80, target_weight_kg: 72, pace_kg_per_week: 0.5 } },
      weight_logs: { data: dailyWeighIns(15, 80, -0.1) },
    })
    const body = await (await GET()).json()
    expect(body.projection.kind).toBe('measured')
    expect(body.projection.headline).toMatch(/On track for 72 kg/)
  })

  it('never throws — a DB error degrades to no line, still 200', async () => {
    wire({
      profiles: { select: { data: null, error: { message: 'db down' } } },
      weight_logs: { data: [] },
    })
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).projection).toBeNull()
  })
})

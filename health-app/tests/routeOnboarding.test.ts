/**
 * The onboarding submit route.
 *
 * It computes calorie/macro targets from the wizard payload and writes the
 * profile. The bug this pins: `pace_kg_per_week` fed the macro maths but was
 * never written to `profiles`, so every downstream screen (the plan story, the
 * dashboard goal-date card) read the column default of 0.5 regardless of what
 * the user picked.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
}))

vi.mock('../lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))

const { POST } = await import('../app/api/onboarding/route')

const USER = { id: 'user-1', email: 'a@b.com' }

const BASE_PAYLOAD = {
  display_name: 'Asha',
  age: 30,
  sex: 'female' as const,
  height_cm: 165,
  current_weight_kg: 70,
  target_weight_kg: 60,
  goal: 'lose' as const,
  activity_level: 'moderate' as const,
  pace_kg_per_week: 0.5,
}

function wire(options: MockOptions = {}) {
  const mock = createSupabaseMock({ user: USER, tables: { profiles: { data: null, error: null } }, ...options })
  createServerClient.mockReturnValue(mock.client)
  return mock
}

function post(payload: Record<string, unknown>) {
  return POST(
    new Request('http://localhost/api/onboarding', { method: 'POST', body: JSON.stringify(payload) }),
  )
}

/** The first write to `profiles` (the main target update). */
const profileUpdate = (mock: ReturnType<typeof wire>) =>
  mock.callsTo('profiles').find((c) => c.operation === 'update')

beforeEach(() => vi.clearAllMocks())

describe('POST /api/onboarding', () => {
  it('persists the picked pace_kg_per_week alongside the targets', async () => {
    const mock = wire()
    const res = await post({ ...BASE_PAYLOAD, pace_kg_per_week: 0.25 })
    expect(res.status).toBe(200)

    const payload = profileUpdate(mock)?.payload as Record<string, unknown>
    expect(payload.pace_kg_per_week).toBe(0.25)
    // the rest of the profile is still written
    expect(payload).toMatchObject({
      display_name: 'Asha',
      goal: 'lose',
      daily_calorie_target: expect.any(Number),
      protein_g_target: expect.any(Number),
    })
  })

  it('a faster pace yields a lower calorie target (proves pace still drives the maths)', async () => {
    const slow = wire()
    await post({ ...BASE_PAYLOAD, pace_kg_per_week: 0.25 })
    const slowKcal = (profileUpdate(slow)?.payload as Record<string, number>).daily_calorie_target

    vi.clearAllMocks()
    const fast = wire()
    await post({ ...BASE_PAYLOAD, pace_kg_per_week: 1.0 })
    const fastKcal = (profileUpdate(fast)?.payload as Record<string, number>).daily_calorie_target

    expect(fastKcal).toBeLessThan(slowKcal)
  })

  it('still fires onboarding_completed', async () => {
    const { captureServerEvent } = await import('../lib/posthog/server')
    wire()
    await post(BASE_PAYLOAD)
    expect(captureServerEvent).toHaveBeenCalledWith('user-1', 'onboarding_completed', { goal: 'lose' })
  })

  it('400s an invalid payload', async () => {
    wire()
    expect((await post({ ...BASE_PAYLOAD, pace_kg_per_week: 9 })).status).toBe(400)
  })
})

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

/**
 * The second write — the best-effort one carrying start_weight_kg and the
 * migration-040 columns, kept separate so an unapplied column can't fail
 * onboarding.
 */
const bestEffortUpdate = (mock: ReturnType<typeof wire>) =>
  mock.callsTo('profiles').filter((c) => c.operation === 'update')[1]

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
    expect(captureServerEvent).toHaveBeenCalledWith('user-1', 'onboarding_completed', {
      goal: 'lose',
      body_focus: 'fat_loss',
    })
  })

  it('400s an invalid payload', async () => {
    wire()
    expect((await post({ ...BASE_PAYLOAD, pace_kg_per_week: 9 })).status).toBe(400)
  })
})

describe('POST /api/onboarding — body_focus', () => {
  it('recomp writes goal "lose" at the pinned 0.25 pace, overriding the client', async () => {
    const mock = wire()
    // The client sends a fast pace; the derivation must win, or "build muscle"
    // ships with a 1,100 kcal deficit.
    const res = await post({ ...BASE_PAYLOAD, body_focus: 'recomp', pace_kg_per_week: 1.0 })
    expect(res.status).toBe(200)

    const payload = profileUpdate(mock)?.payload as Record<string, unknown>
    expect(payload.goal).toBe('lose')
    expect(payload.pace_kg_per_week).toBe(0.25)
  })

  it('muscle_gain writes goal "gain" and a surplus above maintenance', async () => {
    const mock = wire()
    await post({ ...BASE_PAYLOAD, body_focus: 'muscle_gain', goal: 'lose' })

    const payload = profileUpdate(mock)?.payload as Record<string, number | string>
    expect(payload.goal).toBe('gain')
    expect(payload.pace_kg_per_week).toBe(0.25)

    // A surplus, not a deficit: strictly more than the same profile losing.
    vi.clearAllMocks()
    const losing = wire()
    await post({ ...BASE_PAYLOAD, body_focus: 'fat_loss' })
    const losingKcal = (profileUpdate(losing)?.payload as Record<string, number>).daily_calorie_target
    expect(payload.daily_calorie_target as number).toBeGreaterThan(losingKcal)
  })

  it('never writes a fourth value into the three-value goal column', async () => {
    for (const focus of ['fat_loss', 'recomp', 'maintain', 'muscle_gain']) {
      vi.clearAllMocks()
      const mock = wire()
      await post({ ...BASE_PAYLOAD, body_focus: focus })
      const payload = profileUpdate(mock)?.payload as Record<string, unknown>
      expect(['lose', 'maintain', 'gain']).toContain(payload.goal)
    }
  })

  it('persists body_focus and body_type in the best-effort write', async () => {
    const mock = wire()
    await post({ ...BASE_PAYLOAD, body_focus: 'recomp', body_type: 'skinny_fat' })

    expect(bestEffortUpdate(mock)?.payload).toMatchObject({
      start_weight_kg: 70,
      body_focus: 'recomp',
      body_type: 'skinny_fat',
    })
  })

  it('a payload with no body_focus behaves exactly as before', async () => {
    const mock = wire()
    const res = await post({ ...BASE_PAYLOAD, pace_kg_per_week: 0.75 })
    expect(res.status).toBe(200)

    const payload = profileUpdate(mock)?.payload as Record<string, unknown>
    expect(payload.goal).toBe('lose')
    // The client's pace survives — fat_loss pins nothing.
    expect(payload.pace_kg_per_week).toBe(0.75)
    // ...and the focus is back-filled from the goal it did send.
    expect(bestEffortUpdate(mock)?.payload).toMatchObject({ body_focus: 'fat_loss' })
  })

  it('400s a body_focus outside the enum', async () => {
    wire()
    expect((await post({ ...BASE_PAYLOAD, body_focus: 'recomposition' })).status).toBe(400)
  })

  it('400s "recomp" sent as a goal — the goal enum did not grow', async () => {
    wire()
    expect((await post({ ...BASE_PAYLOAD, goal: 'recomp' })).status).toBe(400)
  })
})

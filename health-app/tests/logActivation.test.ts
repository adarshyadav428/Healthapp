import { describe, it, expect } from 'vitest'
import { createSupabaseMock } from './helpers/supabaseMock'
import { getLogActivationContext } from '../lib/logActivation'

/**
 * 2026-09-05 adversarial-audit F2. Unlike every gating call site fixed
 * alongside this one, a subscription-read failure here must NOT reject the
 * whole activation-context read — this feeds the insert path of every
 * logging route, and a blip on this one field must never block someone from
 * logging food. is_pro only feeds analytics and the log-paywall interstitial
 * (lib/logMilestones.ts: `!m.isPro && totalLogs >= threshold` shows the
 * upgrade screen), so resolving toward Pro on a failure costs at most one
 * skipped upsell nudge — never a wrongly-shown paywall to an already-paying
 * user, and never a broken log.
 */
describe('getLogActivationContext — subscription read failure', () => {
  it('resolves is_pro to true (not false) when the subscription read fails, and does not throw', async () => {
    const mock = createSupabaseMock({
      tables: {
        food_logs: { select: [{ count: 0 }, { data: [] }] },
        profiles: { data: { created_at: '2026-01-01T00:00:00Z' } },
        subscriptions: { data: null, error: { message: 'connection reset' } },
        streak_rescues: { data: [] },
      },
    })
    const ctx = await getLogActivationContext(mock.client, 'user-1')
    expect(ctx.is_pro).toBe(true)
  })

  it('still resolves is_pro correctly when the read succeeds', async () => {
    const mock = createSupabaseMock({
      tables: {
        food_logs: { select: [{ count: 0 }, { data: [] }] },
        profiles: { data: { created_at: '2026-01-01T00:00:00Z' } },
        subscriptions: { data: { status: 'canceled' }, error: null },
        streak_rescues: { data: [] },
      },
    })
    const ctx = await getLogActivationContext(mock.client, 'user-1')
    expect(ctx.is_pro).toBe(false)
  })
})

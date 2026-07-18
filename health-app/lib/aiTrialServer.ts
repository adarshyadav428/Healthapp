import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { decideAiTrial, type AiTrialDecision } from './aiTrial'

/**
 * Server-side enforcement of the free AI trial — see ./aiTrial for the rules
 * and the reasoning behind them.
 */

/**
 * Lifetime AI calls this user has made, across both surfaces.
 *
 * The two usage tables are append-only (nothing prunes them), so a row count is
 * the lifetime figure — no new column or migration needed. Camera and chat draw
 * on ONE shared pool: the trial exists to demo "AI logging", not to hand out
 * two separate budgets.
 *
 * Returns null if either count failed. Callers must treat that as "deny" —
 * migration 015 is known to have landed half-applied in the past, and a counter
 * that silently reads zero is exactly how the old daily limit stopped being
 * enforced. Failing closed costs a free user one scan; failing open costs money.
 */
export async function countAiTrialUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<number | null> {
  const [camera, chat] = await Promise.all([
    supabase.from('camera_photo_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('chat_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  const failed = camera.error ?? chat.error
  if (failed) {
    Sentry.captureException(new Error('AI trial count failed'), {
      extra: { userId, supabaseError: failed.message, code: failed.code },
      tags: { area: 'entitlements' },
    })
    console.error(`[ai-trial] count failed for ${userId}: ${failed.message}`)
    return null
  }

  return (camera.count ?? 0) + (chat.count ?? 0)
}

/**
 * Full check for a non-Pro user: reads the profile's verification stamp and the
 * usage count, then applies the pure decision.
 */
export async function checkAiTrial(
  supabase: SupabaseClient,
  userId: string
): Promise<AiTrialDecision> {
  const [profileRes, usedCount] = await Promise.all([
    supabase.from('profiles').select('email_verified_at').eq('id', userId).maybeSingle(),
    countAiTrialUsage(supabase, userId),
  ])

  // Fail closed on either read — see countAiTrialUsage.
  if (profileRes.error || usedCount === null) return { allowed: false, block: 'exhausted' }

  return decideAiTrial({
    emailVerifiedAt: (profileRes.data?.email_verified_at as string | null) ?? null,
    usedCount,
  })
}

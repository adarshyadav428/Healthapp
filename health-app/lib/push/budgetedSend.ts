import { createAdminClient } from '../supabase/server'
import { sendPushToUser, type PushPayload } from './send'
import { canSendPush, IGNORED_BEFORE_BACKOFF, type PushKind } from '../pushBudget'

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** IST calendar day — the day a user experiences, matching streaks and logs. */
function istDay(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

export type BudgetedResult =
  | { sent: number; removed: number; skipped?: undefined }
  | { sent: 0; removed: 0; skipped: 'daily_cap' | 'backoff' | 'outranked' | 'budget_unreadable' }

/**
 * Send a push, subject to the budget.
 *
 * Every cron must go through here rather than calling sendPushToUser directly,
 * because the budget only works if nothing can bypass it. The plain sender
 * stays exported for the one legitimate case — a user-triggered test send —
 * but scheduled notifications belong here.
 *
 * Failures to record a send are swallowed: losing the bookkeeping is worth far
 * less than losing the notification, and the worst case is one extra push.
 * **The two reads are the opposite case and must fail CLOSED** — see below.
 */
export async function sendBudgetedPush(
  userId: string,
  kind: PushKind,
  payload: PushPayload,
  now = new Date()
): Promise<BudgetedResult> {
  const admin = createAdminClient()
  const today = istDay(now)

  const [sentTodayRes, recentRes] = await Promise.all([
    admin.from('push_sends').select('kind').eq('user_id', userId).eq('sent_on', today),
    admin
      .from('push_sends')
      .select('opened_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(IGNORED_BEFORE_BACKOFF),
  ])

  // Fail CLOSED on either read. supabase-js *resolves* with { data, error }, so
  // taking `data` alone turned a failed read into "nothing sent today, nothing
  // ignored" — which lifts the daily cap and clears the back-off at the same
  // time. A blip would then push EVERY subscribed user, including the ones at
  // 5+ ignored that the back-off exists to protect. CLAUDE.md makes the budget
  // a hard rule ("the one-push-per-day budget only works if nothing bypasses
  // it"), and a silently-empty read is a bypass.
  //
  // Skipping one notification is the cheap failure; spamming the whole base is
  // the expensive one, and it costs the notification permission permanently.
  if (sentTodayRes.error || recentRes.error) {
    return { sent: 0, removed: 0, skipped: 'budget_unreadable' }
  }

  const todayRows = sentTodayRes.data
  const recent = recentRes.data

  // Consecutive unopened, newest first. Stops at the first opened one, so a
  // single re-engagement resets the back-off rather than holding it against
  // someone forever.
  let consecutiveIgnored = 0
  for (const row of recent ?? []) {
    if (row.opened_at) break
    consecutiveIgnored += 1
  }

  const verdict = canSendPush(kind, {
    sentToday: ((todayRows ?? []).map((r) => r.kind) as PushKind[]),
    consecutiveIgnored,
  })

  if (!verdict.allowed) return { sent: 0, removed: 0, skipped: verdict.reason }

  const result = await sendPushToUser(userId, { ...payload, tag: payload.tag ?? kind })

  // Only a delivered push counts against the budget. Recording one that never
  // reached a device would silently starve the user of tomorrow's.
  if (result.sent > 0) {
    await admin
      .from('push_sends')
      .insert({ user_id: userId, kind, sent_on: today })
      .then(undefined, () => undefined)
  }

  return result
}

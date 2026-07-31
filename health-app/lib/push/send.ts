import webpush from 'web-push'
import { createAdminClient } from '../supabase/server'

let configured = false

function ensureConfigured() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) {
    throw new Error('Missing VAPID env vars (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT)')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

/**
 * Sends a push notification to every subscription a user has (multiple
 * devices/browsers). Expired/invalid subscriptions (410 Gone, 404 Not Found)
 * are deleted so they stop being retried on future sends.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; removed: number }> {
  ensureConfigured()
  const admin = createAdminClient()

  // Distinguish "this user has no devices" from "we could not find out".
  // Discarding `error` made a failed read return { sent: 0 } — identical to the
  // legitimate no-subscription case — so a DB blip looked like a quiet no-op to
  // sendBudgetedPush and to the cron summaries built on it. That is exactly how
  // a silently-broken limit went unnoticed for weeks before; a read failure must
  // be loud.
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error) throw new Error(`push_subscriptions read failed: ${error.message}`)
  if (!subs || subs.length === 0) return { sent: 0, removed: 0 }

  let sent = 0
  let removed = 0

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        )
        sent += 1
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id)
          removed += 1
        } else {
          console.error('[push/send] failed for subscription', sub.id, err)
        }
      }
    })
  )

  return { sent, removed }
}

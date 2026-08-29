import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '../../../../lib/supabase/server'
import { getPlaySubscription } from '../../../../lib/play/verify'
import { captureServerEvent } from '../../../../lib/posthog/server'

// Google Play RTDN notificationType values we act on for analytics.
// 4 = SUBSCRIPTION_PURCHASED, 12 = SUBSCRIPTION_REVOKED (refund / chargeback).
const NOTIFICATION_REVOKED = 12

export const runtime = 'nodejs'

// Google Play Real-time Developer Notifications (RTDN), delivered via a Cloud
// Pub/Sub PUSH subscription. This is the Play analogue of the Stripe webhook:
// it keeps `subscriptions` fresh on renew / cancel / grace / revoke / expire.
//
// Pub/Sub push body: { message: { data: <base64 JSON>, messageId }, subscription }
// Decoded data is a DeveloperNotification with an optional subscriptionNotification:
//   { purchaseToken, subscriptionId, notificationType }
//
// Always returns 200 (except auth) so Pub/Sub does not retry-storm.
export async function POST(req: Request) {
  // Guard the public endpoint with a shared secret in the push URL.
  const url = new URL(req.url)
  const secret = process.env.PLAY_RTDN_SECRET
  if (!secret || url.searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = (await req.json()) as { message?: { data?: string } }
    const dataB64 = body.message?.data
    if (!dataB64) return NextResponse.json({ received: true })

    const decoded = JSON.parse(Buffer.from(dataB64, 'base64').toString('utf8')) as {
      subscriptionNotification?: { purchaseToken?: string; notificationType?: number }
      testNotification?: unknown
    }

    const purchaseToken = decoded.subscriptionNotification?.purchaseToken
    const notificationType = decoded.subscriptionNotification?.notificationType
    if (!purchaseToken) {
      // testNotification or a one-time-product notification — nothing to sync.
      return NextResponse.json({ received: true })
    }

    const admin = createAdminClient()

    // The token identifies an existing entitlement row (created at /api/play/verify).
    // Both the lookup and the write below check `error` on purpose. This route
    // always answers 200 (see the catch) so Pub/Sub doesn't redeliver forever —
    // which means a discarded error here is invisible AND unretried: the row
    // keeps its old status, so a cancelled subscriber silently keeps Pro, or a
    // renewed one is left looking expired. Money either way. Raising sends it to
    // the catch, which reports it and still returns 200.
    const { data: existing, error: lookupError } = await admin
      .from('subscriptions')
      .select('user_id, status')
      .eq('play_purchase_token', purchaseToken)
      .maybeSingle()

    if (lookupError) throw new Error(`subscription lookup failed: ${lookupError.message}`)
    if (!existing) return NextResponse.json({ received: true })

    const prevStatus = (existing as { status?: string }).status ?? null
    const userId = (existing as { user_id?: string }).user_id ?? null

    const sub = await getPlaySubscription(purchaseToken)
    const { error: updateError } = await admin
      .from('subscriptions')
      .update({ status: sub.status, current_period_end: sub.expiryTime })
      .eq('play_purchase_token', purchaseToken)

    if (updateError) throw new Error(`subscription update failed: ${updateError.message}`)

    // Lifecycle analytics — emitted only after the write lands. Fire-and-forget;
    // a missing PostHog key no-ops. The status transitions the funnel could
    // never see before: trial → paid, and any → cancelled/revoked.
    if (userId) {
      if (prevStatus === 'trialing' && sub.status === 'active') {
        captureServerEvent(userId, 'trial_converted', { provider: 'google_play' })
      }
      if (sub.status === 'canceled' && prevStatus !== 'canceled') {
        captureServerEvent(userId, 'subscription_cancelled', {
          provider: 'google_play',
          reason: 'rtdn',
        })
      }
      if (notificationType === NOTIFICATION_REVOKED) {
        captureServerEvent(userId, 'subscription_refunded', { provider: 'google_play' })
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    // Still 200 so Pub/Sub doesn't redeliver indefinitely — but because we
    // swallow the retry, this is the ONLY signal that a billing state failed to
    // apply. console.error alone is easy to miss in serverless logs, so it also
    // goes to Sentry: a dropped RTDN is a subscriber on the wrong entitlement.
    console.error('[play/rtdn] failed:', (err as Error).message)
    Sentry.captureException(err, { tags: { route: 'play/rtdn' } })
    return NextResponse.json({ received: true })
  }
}

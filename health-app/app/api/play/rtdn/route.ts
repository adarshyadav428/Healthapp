import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/server'
import { getPlaySubscription } from '../../../../lib/play/verify'

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
      subscriptionNotification?: { purchaseToken?: string }
      testNotification?: unknown
    }

    const purchaseToken = decoded.subscriptionNotification?.purchaseToken
    if (!purchaseToken) {
      // testNotification or a one-time-product notification — nothing to sync.
      return NextResponse.json({ received: true })
    }

    const admin = createAdminClient()

    // The token identifies an existing entitlement row (created at /api/play/verify).
    const { data: existing } = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('play_purchase_token', purchaseToken)
      .maybeSingle()

    if (!existing) return NextResponse.json({ received: true })

    const sub = await getPlaySubscription(purchaseToken)
    await admin
      .from('subscriptions')
      .update({ status: sub.status, current_period_end: sub.expiryTime })
      .eq('play_purchase_token', purchaseToken)

    return NextResponse.json({ received: true })
  } catch (err) {
    // Log but still 200 so Pub/Sub doesn't redeliver indefinitely.
    console.error('[play/rtdn] failed:', (err as Error).message)
    return NextResponse.json({ received: true })
  }
}

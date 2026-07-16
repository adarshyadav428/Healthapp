import { NextResponse } from 'next/server'
import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils'
import { createAdminClient } from '../../../../lib/supabase/server'

export const runtime = 'nodejs'

type RazorpaySubscriptionEntity = {
  id: string
  status: string
  current_end?: number | null
}

// Razorpay's analogue of the Stripe webhook — the authoritative, ongoing
// source of truth for subscription lifecycle (renewals, failures,
// cancellations), independent of whether the client-side /verify call ever
// completed (e.g. the user closed the tab right after paying).
export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  const signature = req.headers.get('x-razorpay-signature')
  if (!secret || !signature) {
    return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 })
  }

  const rawBody = await req.text()
  const valid = validateWebhookSignature(rawBody, signature, secret)
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })

  let event: { event: string; payload?: { subscription?: { entity?: RazorpaySubscriptionEntity } } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()
  const sub = event.payload?.subscription?.entity

  try {
    switch (event.event) {
      case 'subscription.activated':
      case 'subscription.charged': {
        if (sub) {
          await admin
            .from('subscriptions')
            .update({
              status: 'active',
              current_period_end: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null,
              // A charge/activation means no cancellation is pending anymore.
              cancel_at_period_end: false,
            })
            .eq('razorpay_subscription_id', sub.id)
        }
        break
      }
      case 'subscription.halted': {
        if (sub) {
          await admin.from('subscriptions').update({ status: 'past_due' }).eq('razorpay_subscription_id', sub.id)
        }
        break
      }
      case 'subscription.cancelled':
      case 'subscription.completed': {
        if (sub) {
          await admin.from('subscriptions').update({ status: 'canceled' }).eq('razorpay_subscription_id', sub.id)
        }
        break
      }
      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    // Unlike the Play RTDN handler (which always 200s to avoid a Pub/Sub
    // retry storm), Razorpay's retry-on-failure behavior is what we want
    // here — a genuine DB write failure should be retried, not swallowed.
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

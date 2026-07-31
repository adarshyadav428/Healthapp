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

  /**
   * Apply one status write, raising if it did not land.
   *
   * supabase-js RESOLVES with `{ error }` on a failed write — it does not
   * throw — so `await`ing it inside the try below is not enough on its own: the
   * catch never fires and the route answers 200. That is the swallowed-error
   * class the 2026-07-31 audit fixed in the RTDN route (P1-4) and missed here,
   * and here it is worse: 200 tells Razorpay the event was handled, so it never
   * retries, and the row keeps its old status. A cancelled subscriber silently
   * keeps Pro; a renewed one is left looking expired. Money either way.
   *
   * Pinned by tests/webhookSignatures.test.ts.
   */
  async function applyStatus(fields: Record<string, unknown>) {
    if (!sub) return
    const { error } = await admin
      .from('subscriptions')
      .update(fields)
      .eq('razorpay_subscription_id', sub.id)
    if (error) {
      throw new Error(`subscription update failed for ${sub.id}: ${error.message}`)
    }
  }

  try {
    switch (event.event) {
      case 'subscription.activated':
      case 'subscription.charged': {
        await applyStatus({
          status: 'active',
          current_period_end: sub?.current_end
            ? new Date(sub.current_end * 1000).toISOString()
            : null,
          // A charge/activation means no cancellation is pending anymore.
          cancel_at_period_end: false,
        })
        break
      }
      case 'subscription.halted': {
        await applyStatus({ status: 'past_due' })
        break
      }
      case 'subscription.cancelled':
      case 'subscription.completed': {
        await applyStatus({ status: 'canceled' })
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

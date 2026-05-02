import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getStripeClient } from '../../../../lib/stripe/client'
import { createAdminClient } from '../../../../lib/supabase/server'
import type Stripe from 'stripe'

export async function POST(req: Request) {
  const stripe = getStripeClient()
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 })
  }

  const getRawBody = async (request: Request) => {
    const arrayBuffer = await request.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  let event: Stripe.Event
  try {
    const rawBody = await getRawBody(req)
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()
  const normalizePlan = (plan?: string | null) => (plan === 'monthly' || plan === 'annual' ? plan : null)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        if (userId) {
          await admin.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: session.customer?.toString() ?? null,
            stripe_subscription_id: session.subscription?.toString() ?? null,
            status: session.mode === 'payment' ? 'active' : 'trialing',
            plan: normalizePlan(session.metadata?.plan),
            current_period_end: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
          })
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.user_id
        if (userId) {
          await admin.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: subscription.customer?.toString() ?? null,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            plan: normalizePlan(subscription.metadata?.plan),
            current_period_end: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
          })
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription?.toString()
        if (subscriptionId) {
          await admin.from('subscriptions').update({ status: 'past_due' }).eq('stripe_subscription_id', subscriptionId)
        }
        break
      }
      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

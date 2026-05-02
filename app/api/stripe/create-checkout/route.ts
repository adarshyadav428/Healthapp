import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import Stripe from 'stripe'
import { getStripeClient } from '../../../../lib/stripe/client'
import { createServerClient } from '../../../../lib/supabase/server'

const priceMap = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID,
  annual: process.env.STRIPE_ANNUAL_PRICE_ID,
  lifetime: process.env.STRIPE_LIFETIME_PRICE_ID,
} as const

type Plan = keyof typeof priceMap

export async function POST(req: Request) {
  try {
    const stripe = getStripeClient()
    const supabase = createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) throw new Error(userError.message)
    if (!user || !user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { plan } = (await req.json()) as { plan: Plan }
    if (!plan || !priceMap[plan]) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    const customers = await stripe.customers.list({ email: user.email, limit: 1 })
    const customer = customers.data[0] ?? (await stripe.customers.create({ email: user.email }))

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const isSubscription = plan !== 'lifetime'

    const params: Stripe.Checkout.SessionCreateParams = {
      customer: customer.id,
      mode: isSubscription ? 'subscription' : 'payment',
      line_items: [{ price: priceMap[plan] as string, quantity: 1 }],
      success_url: `${appUrl}/dashboard?upgraded=true`,
      cancel_url: `${appUrl}/upgrade`,
      metadata: { user_id: user.id, plan },
    }

    if (isSubscription) {
      const subData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
        metadata: { user_id: user.id, plan },
      }
      if (plan === 'annual') subData.trial_period_days = 7
      params.subscription_data = subData
    }

    const session = await stripe.checkout.sessions.create(params)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { stripe } from '../../../../lib/stripe/client'
import { createServerClient } from '../../../../lib/supabase/server'

const priceMap = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID,
  annual: process.env.STRIPE_ANNUAL_PRICE_ID,
  lifetime: process.env.STRIPE_LIFETIME_PRICE_ID,
} as const

type Plan = keyof typeof priceMap

export async function POST(req: Request) {
  try {
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
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: plan === 'lifetime' ? 'payment' : 'subscription',
      line_items: [{ price: priceMap[plan] as string, quantity: 1 }],
      success_url: `${appUrl}/dashboard?upgraded=true`,
      cancel_url: `${appUrl}/upgrade`,
      trial_period_days: plan === 'annual' ? 7 : undefined,
      subscription_data: plan === 'lifetime' ? undefined : { metadata: { user_id: user.id, plan } },
      metadata: { user_id: user.id, plan },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

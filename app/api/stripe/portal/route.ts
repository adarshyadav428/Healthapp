import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getStripeClient } from '../../../../lib/stripe/client'
import { createServerClient } from '../../../../lib/supabase/server'

export async function POST() {
  try {
    const stripe = getStripeClient()
    const supabase = createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) throw new Error(userError.message)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (subError) throw new Error(subError.message)
    if (!sub?.stripe_customer_id) return NextResponse.json({ error: 'No customer found' }, { status: 400 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${appUrl}/settings`,
    })

    return NextResponse.json({ url: portal.url })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'
import { getRazorpayClient } from '../../../../lib/razorpay/client'
import { planIdFor, totalCountFor } from '../../../../lib/razorpay/plans'

export const runtime = 'nodejs'

type Plan = 'monthly' | 'annual'

// Web checkout path (Razorpay replaces Stripe here — see migration
// 022_razorpay_billing.sql). Creates a Subscription and hands the client
// just enough to open Razorpay's Checkout widget; the customer is created/
// linked automatically by Razorpay once the authorisation payment
// completes, so there's no separate "create customer" step needed here.
export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { plan } = (await req.json()) as { plan: Plan }
    if (plan !== 'monthly' && plan !== 'annual') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const razorpay = getRazorpayClient()
    const subscription = await razorpay.subscriptions.create({
      plan_id: planIdFor(plan),
      total_count: totalCountFor(plan),
      customer_notify: true,
      notes: { user_id: user.id, plan },
    })

    return NextResponse.json({
      subscription_id: subscription.id,
      key_id: process.env.RAZORPAY_KEY_ID,
    })
  } catch (err) {
    // Never surface internal strings ("Missing RAZORPAY_KEY_ID…") to users.
    console.error('[razorpay/create-subscription]', err)
    return NextResponse.json(
      { error: 'Payments are temporarily unavailable. Please try again in a moment.' },
      { status: 503 }
    )
  }
}

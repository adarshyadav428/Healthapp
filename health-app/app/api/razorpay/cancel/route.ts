import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '../../../../lib/supabase/server'
import { getRazorpayClient } from '../../../../lib/razorpay/client'

export const runtime = 'nodejs'

// Razorpay has no hosted self-serve billing portal like Stripe — this is
// the DIY replacement, called from Settings' "Manage Subscription" for
// provider = 'razorpay' users.
export async function POST() {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: sub, error: subError } = await admin
      .from('subscriptions')
      .select('razorpay_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (subError) throw new Error(subError.message)
    if (!sub?.razorpay_subscription_id) {
      return NextResponse.json({ error: 'No active Razorpay subscription' }, { status: 400 })
    }

    const razorpay = getRazorpayClient()
    await razorpay.subscriptions.cancel(sub.razorpay_subscription_id)

    const { error: updateError } = await admin
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('user_id', user.id)
    if (updateError) throw new Error(updateError.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

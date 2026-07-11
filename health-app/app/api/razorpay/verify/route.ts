import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validatePaymentVerification } from 'razorpay/dist/utils/razorpay-utils'
import { createServerClient, createAdminClient } from '../../../../lib/supabase/server'
import { captureServerEvent } from '../../../../lib/posthog/server'

export const runtime = 'nodejs'

const schema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_subscription_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  plan: z.enum(['monthly', 'annual']),
})

// Called by the client immediately after the Razorpay Checkout widget
// completes. Verifies the payment signature server-side (mirrors
// /api/play/verify's immediate-confirmation step), then optimistically
// upserts the entitlement — the webhook is still the authoritative,
// ongoing source of truth for renewals/failures/cancellations, this just
// avoids the user waiting on webhook latency to see Pro unlock.
export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, plan } = parsed.data
    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) throw new Error('Missing RAZORPAY_KEY_SECRET')

    const valid = validatePaymentVerification(
      { payment_id: razorpay_payment_id, subscription_id: razorpay_subscription_id },
      razorpay_signature,
      secret
    )
    if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin.from('subscriptions').upsert({
      user_id: user.id,
      provider: 'razorpay',
      razorpay_subscription_id,
      status: 'active',
      plan,
      current_period_end: null, // filled in by the webhook once Razorpay confirms the billing cycle
      stripe_customer_id: null,
      stripe_subscription_id: null,
      play_purchase_token: null,
      play_product_id: null,
    })
    if (error) throw new Error(error.message)

    captureServerEvent(user.id, 'subscription_started', { provider: 'razorpay', plan })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

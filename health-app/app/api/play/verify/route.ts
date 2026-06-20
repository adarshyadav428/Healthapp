import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, createAdminClient } from '../../../../lib/supabase/server'
import { getPlaySubscription, acknowledgePlaySubscription } from '../../../../lib/play/verify'
import { planForProductId } from '../../../../lib/play/products'

export const runtime = 'nodejs'

const schema = z.object({
  purchaseToken: z.string().min(1),
  productId: z.string().min(1),
})

// Called by the TWA client immediately after a Google Play purchase completes.
// Verifies the token server-side, acknowledges it, and upserts the entitlement
// into `subscriptions` (provider = 'google_play') using the shared status vocab.
export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user ?? null
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

    const { purchaseToken, productId } = parsed.data
    const plan = planForProductId(productId)
    if (!plan) return NextResponse.json({ error: 'Unknown product' }, { status: 400 })

    const sub = await getPlaySubscription(purchaseToken)
    if (!sub.entitled) {
      // Token is valid but not in an entitled state (canceled/expired/on-hold).
      return NextResponse.json({ error: 'Purchase not active', state: sub.state }, { status: 409 })
    }

    if (sub.needsAcknowledgement) {
      await acknowledgePlaySubscription(productId, purchaseToken)
    }

    const admin = createAdminClient()
    const { error } = await admin.from('subscriptions').upsert({
      user_id: user.id,
      provider: 'google_play',
      play_purchase_token: purchaseToken,
      play_product_id: productId,
      status: sub.status,
      plan,
      current_period_end: sub.expiryTime,
      // Null out Stripe fields so a row that switched providers stays coherent.
      stripe_customer_id: null,
      stripe_subscription_id: null,
    })
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, status: sub.status })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, createAdminClient } from '../../../../lib/supabase/server'
import { getPlaySubscription, acknowledgePlaySubscription } from '../../../../lib/play/verify'
import { planForProductId } from '../../../../lib/play/products'
import { captureServerEvent } from '../../../../lib/posthog/server'

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
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

    const { purchaseToken, productId } = parsed.data
    const plan = planForProductId(productId)
    if (!plan) return NextResponse.json({ error: 'Unknown product' }, { status: 400 })

    // One purchase entitles one account. Without this, a single Play purchase
    // token replayed from other accounts would entitle each of them (the
    // upsert below conflicts on user_id, so every replayer gets their own
    // row). Re-verifying your own token stays idempotent. A unique index on
    // play_purchase_token (023_billing_hardening.sql) backs this against
    // concurrent requests.
    const admin = createAdminClient()
    const { data: tokenOwner, error: tokenOwnerError } = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('play_purchase_token', purchaseToken)
      .neq('user_id', user.id)
      .maybeSingle()
    if (tokenOwnerError) throw new Error(tokenOwnerError.message)
    if (tokenOwner) {
      captureServerEvent(user.id, 'play_token_replay_blocked', { productId })
      return NextResponse.json(
        { error: 'This purchase is already linked to a different account.' },
        { status: 409 }
      )
    }

    const sub = await getPlaySubscription(purchaseToken)
    if (!sub.entitled) {
      // Token is valid but not in an entitled state (canceled/expired/on-hold).
      return NextResponse.json({ error: 'Purchase not active', state: sub.state }, { status: 409 })
    }

    if (sub.needsAcknowledgement) {
      await acknowledgePlaySubscription(productId, purchaseToken)
    }

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

    captureServerEvent(user.id, 'upgrade_completed', { provider: 'google_play', plan })

    return NextResponse.json({ ok: true, status: sub.status })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

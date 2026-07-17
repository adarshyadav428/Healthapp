import { NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '../../../../lib/supabase/server'
import { getRazorpayClient } from '../../../../lib/razorpay/client'
import { getStripeClient } from '../../../../lib/stripe/client'

export const runtime = 'nodejs'

const ACTIVE = new Set(['active', 'trialing', 'past_due'])

// Deleting the auth user cascades every row, but the *provider-side*
// subscription keeps billing unless we cancel it first. Razorpay has no
// self-serve portal, so if we don't cancel here a deleted web subscriber pays
// forever with no way to stop (audit P1-8). Cancel first, then delete.
export async function POST() {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: sub } = await admin
      .from('subscriptions')
      .select('provider, status, razorpay_subscription_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (sub && ACTIVE.has(sub.status as string)) {
      // Google Play subscriptions can only be cancelled by the user in Google
      // Play — we have no API to do it. Block deletion with clear guidance so
      // the user isn't silently left paying Google after their account is gone.
      if (sub.provider === 'google_play') {
        return NextResponse.json(
          {
            error:
              'Please cancel your subscription in Google Play first (Play Store → Subscriptions → GetInShape), then delete your account.',
          },
          { status: 409 }
        )
      }

      try {
        if (sub.provider === 'razorpay' && sub.razorpay_subscription_id) {
          // Immediate cancel (false) — the account is going away now.
          await getRazorpayClient().subscriptions.cancel(sub.razorpay_subscription_id, false)
        } else if (sub.provider === 'stripe' && sub.stripe_subscription_id) {
          await getStripeClient().subscriptions.cancel(sub.stripe_subscription_id)
        }
      } catch (cancelErr) {
        console.error('[account/delete] provider cancel failed', cancelErr)
        return NextResponse.json(
          {
            error:
              "We couldn't cancel your subscription automatically. Please cancel it from Settings → Manage Subscription first, then delete your account.",
          },
          { status: 502 }
        )
      }
    }

    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[account/delete]', err)
    return NextResponse.json({ error: 'Something went wrong deleting your account. Please try again.' }, { status: 500 })
  }
}

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
    // A failed read here must never be treated as "no subscription" — that
    // would silently skip the cancel-or-block branch below and let an active
    // subscription's account be deleted while the provider keeps billing it,
    // with nobody left able to manage or cancel it. Fail the whole request
    // instead: no cancellation decision can be made without this row.
    const { data: sub, error: subReadError } = await admin
      .from('subscriptions')
      .select('provider, status, razorpay_subscription_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (subReadError) {
      console.error('[account/delete] subscription read failed', subReadError)
      return NextResponse.json(
        { error: "We couldn't verify your subscription. Please try again." },
        { status: 500 }
      )
    }

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

      // sub.status is already 'canceled' locally means a PRIOR run of this
      // route already cancelled the provider-side subscription and recorded
      // it, but then failed before deleteUser() ran (see below) — retrying
      // the provider cancel would just error against an already-cancelled
      // subscription. Skip straight to deletion; ACTIVE.has('canceled') is
      // false so this branch is only reached for a genuinely live status.
      if (sub.provider === 'razorpay' || sub.provider === 'stripe') {
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

        // Persist the cancellation BEFORE deleting the user. If deleteUser()
        // below then fails, the account survives with status already
        // 'canceled' — so a retry of this route skips straight past the
        // ACTIVE.has() check above instead of re-cancelling (and erroring
        // against) an already-cancelled provider subscription. Skipping this
        // write and deleting anyway would make it harmless *when deleteUser
        // succeeds* (the cascade removes the row seconds later regardless),
        // but leaves this exact retry-deadlock the one time it doesn't.
        const { error: cancelWriteError } = await admin
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('user_id', user.id)
        if (cancelWriteError) {
          console.error('[account/delete] failed to record cancellation', cancelWriteError)
          return NextResponse.json(
            {
              error:
                'Your subscription was cancelled, but we could not finish deleting your account. Please try again — your card will not be charged again.',
            },
            { status: 500 }
          )
        }
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

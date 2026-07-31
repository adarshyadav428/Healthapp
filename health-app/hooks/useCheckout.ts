'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../components/ui/use-toast'
import { captureEvent } from '../lib/posthog/client'
import { loadPlayBilling, purchasePlan } from '../lib/play/billing'
import { PLAY_PRODUCTS } from '../lib/play/products'
import { CHECKOUT_CANCELLED, isCheckoutCancellation } from '../lib/checkoutErrors'

type Plan = 'monthly' | 'annual'

type RazorpaySuccessResponse = {
  razorpay_payment_id: string
  razorpay_subscription_id: string
  razorpay_signature: string
}

declare global {
  interface Window {
    Razorpay: new (options: {
      key: string
      subscription_id: string
      name: string
      description: string
      prefill?: { email?: string }
      theme?: { color: string }
      handler: (response: RazorpaySuccessResponse) => void
      modal?: { ondismiss?: () => void }
    }) => { open: () => void }
  }
}

export const PLAY_PRODUCT_FOR_PLAN: Record<Plan, string> = {
  monthly: PLAY_PRODUCTS.monthly,
  annual: PLAY_PRODUCTS.annual,
}

type Params = { userId?: string; userEmail?: string | null }

/**
 * Checkout orchestration for /upgrade: detects Google Play billing (inside the
 * TWA) vs Razorpay (web), runs the chosen provider's purchase flow, and fires
 * the checkout_attempted/checkout_failed analytics. Extracted from the page so
 * it's pure presentation. Behaviour, copy and payloads are intentionally identical.
 */
export function useCheckout({ userId, userEmail }: Params) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState<string | null>(null)
  // null = still detecting, true = inside Play TWA, false = web (use Razorpay)
  const [playAvailable, setPlayAvailable] = useState<boolean | null>(null)
  const [playPrices, setPlayPrices] = useState<Record<string, string>>({})
  // Inside the TWA, Play can be present but refuse to sell (merchant
  // verification pending, outage, product id mismatch). Assume it can until
  // told otherwise, so a slow lookup never blocks a checkout that would work.
  const [playSellable, setPlaySellable] = useState(true)

  useEffect(() => {
    let active = true
    loadPlayBilling().then((play) => {
      if (!active) return
      setPlayAvailable(play.available)
      setPlayPrices(play.prices)
      setPlaySellable(!play.available || play.sellable)
    })
    return () => {
      active = false
    }
  }, [])

  /**
   * We're on Play, and Play won't take money. Play policy forbids rerouting to
   * Razorpay from inside the TWA, so the buttons go quiet instead of opening a
   * sheet that fails — a dead purchase is a worse first impression than an
   * honest "not right now", and it's what a Play reviewer would see too.
   */
  const purchasesUnavailable = playAvailable === true && !playSellable

  /**
   * Where both providers land once the entitlement exists.
   *
   * `/welcome` gates on status being active OR trialing rather than on money
   * having moved, which matters inside the TWA: Play grants a 3-day trial and
   * captures nothing until it ends, so a payment-captured trigger would hide
   * this from precisely the users who most need a reason to stay.
   *
   * No toast any more — a 2.5s "Welcome to Pro!" that vanishes before it's read
   * was the entire reward for paying, and it's what this replaces.
   */
  const goToWelcome = () => {
    queryClient.invalidateQueries({ queryKey: ['subscription', userId] })
    router.replace('/welcome')
  }

  // Google Play Billing path (inside the TWA) — verify happens server-side.
  const startPlayPurchase = async (plan: Plan) => {
    const result = await purchasePlan(PLAY_PRODUCT_FOR_PLAN[plan])
    if (result.ok) {
      goToWelcome()
    } else {
      throw new Error(result.error)
    }
  }

  // Razorpay path (web / iOS PWA / desktop) — Stripe barely supports
  // India-domestic INR recurring under RBI mandate rules, so this replaces
  // it for all new web checkouts (existing Stripe subscribers are
  // untouched — see migration 022_razorpay_billing.sql). Opens Razorpay's
  // Checkout widget rather than redirecting, since subscriptions are
  // authorised in-modal, not via a hosted page like Stripe Checkout.
  const startRazorpayCheckout = (plan: Plan) =>
    new Promise<void>((resolve, reject) => {
      fetch('/api/razorpay/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          if (typeof window.Razorpay !== 'function') throw new Error('Payment widget failed to load — please retry.')

          const rzp = new window.Razorpay({
            key: data.key_id,
            subscription_id: data.subscription_id,
            name: 'GetInShape',
            description: plan === 'monthly' ? 'Pro Monthly' : 'Pro Annual',
            prefill: { email: userEmail ?? undefined },
            // Razorpay's widget renders outside our DOM (its own iframe/modal), so it
            // can't read var(--brand) — read the live computed value instead so the
            // widget matches the active light/dark theme rather than one hardcoded hex.
            theme: { color: getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#F1662E' }, // token-check-ignore
            handler: (response) => {
              fetch('/api/razorpay/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...response, plan }),
              })
                .then(async (verifyRes) => {
                  const verifyData = await verifyRes.json()
                  if (!verifyRes.ok) throw new Error(verifyData.error)
                  goToWelcome()
                  resolve()
                })
                .catch(reject)
            },
            modal: { ondismiss: () => reject(new Error(CHECKOUT_CANCELLED)) },
          })
          rzp.open()
        })
        .catch(reject)
    })

  const startCheckout = async (plan: Plan) => {
    if (loading) return
    if (purchasesUnavailable) {
      captureEvent('checkout_failed', { plan, provider: 'google_play', error: 'play_not_sellable' })
      toast({
        title: 'Purchases are unavailable right now',
        description: 'This is on our side, not yours. Please try again a little later.',
        variant: 'error',
      })
      return
    }
    setLoading(plan)
    const provider = playAvailable ? 'google_play' : 'razorpay'
    captureEvent('checkout_attempted', { plan, provider })
    try {
      if (playAvailable) await startPlayPurchase(plan)
      else await startRazorpayCheckout(plan)
    } catch (err) {
      const message = (err as Error).message
      if (isCheckoutCancellation(message)) {
        // Backing out of the payment sheet isn't a failure — don't count it in
        // the funnel, and don't hand the user Chrome's internal PaymentRequest
        // wording. A neutral line (rather than silence) still tells them the
        // sheet closed without taking money, which is the one thing they'd
        // otherwise have to guess at.
        toast({ title: 'Checkout closed', description: 'No payment was taken.' })
      } else {
        captureEvent('checkout_failed', { plan, provider, error: message })
        toast({ title: 'Checkout failed', description: message, variant: 'error' })
      }
      setLoading(null)
    }
  }

  return { startCheckout, loading, playAvailable, playPrices, purchasesUnavailable }
}

'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Script from 'next/script'
import { Button } from '../../components/ui/button'
import Link from 'next/link'
import { Check, Crown, Zap, ArrowLeft, Lock } from 'lucide-react'
import { useUser } from '../../hooks/useUser'
import { captureEvent } from '../../lib/posthog/client'
import type { PaywallSource } from '../../lib/posthog/events'
import { projectGoalDate, formatGoalDate } from '../../lib/projection'
import { useCheckout, PLAY_PRODUCT_FOR_PLAN } from '../../hooks/useCheckout'
import { useSendVerificationLink } from '../../hooks/useSendVerificationLink'
import { AI_TRIAL_SCANS } from '../../lib/aiTrial'
import { PRICE_MONTHLY, PRICE_ANNUAL, FREE_TRIAL_DAYS } from '../../lib/pricing'

const REASON_COPY: Record<string, { title: string; description: string }> = {
  history:            { title: 'Unlock your full history', description: 'Free users can view the last 7 days. Pro shows everything.' },
  custom_foods:       { title: 'Create custom foods',      description: 'Log your home-cooked dishes and family recipes with Pro.' },
  ai_insights:        { title: 'Get your weekly AI recap', description: 'A summary of your week — calories, days logged, weight change — every Sunday.' },
  exports:            { title: 'Export your data',         description: 'Download your full log as CSV with Pro.' },
  camera_scan_pro:    { title: "You've used your free AI scans", description: 'Point your camera at your plate and let Gemini do the logging. Unlimited with Pro.' },
  chat_scan_pro:      { title: "You've used your free AI scans", description: 'Describe your meal in plain English and let Gemini log it. Unlimited with Pro.' },
  // Not a paywall — the user hasn't spent their trial yet, they just haven't
  // confirmed an email. The plan buttons below already read "Confirm your
  // email first", so this banner explains why that's what they're seeing.
  verify_ai:          { title: `Confirm your email for ${AI_TRIAL_SCANS} free AI scans`, description: `Tap the button below and we'll send you a link. Confirming unlocks ${AI_TRIAL_SCANS} free AI scans — no payment needed.` },
  free_logs:          { title: "You're building a real habit", description: 'Keep the momentum — Pro unlocks your full history, unlimited AI logging and custom foods.' },
}

/**
 * Reasons whose only paywall impression is this page. The other reasons already
 * fire `paywall_viewed` at the gate that blocked the user, so they must not
 * fire again here.
 */
const PAYWALL_SOURCE_ONLY_HERE: Record<string, PaywallSource | undefined> = {
  history: 'history_limit',
  ai_insights: 'recap_end_card',
}

// `note` is the web (Razorpay) wording; `playNote` replaces it inside the TWA.
// The 3-day free trial is a Play Console offer on both products — Razorpay
// checkout charges immediately and has no trial — so promising one on the web
// would be a false claim. Keep these in sync with the Play offers.
const plans = [
  {
    id: 'monthly' as const,
    title: 'Monthly',
    price: PRICE_MONTHLY,
    per: '/month',
    note: 'Cancel anytime',
    playNote: `${FREE_TRIAL_DAYS}-day free trial · cancel anytime`,
    badge: null,
    cta: 'Start Monthly',
    highlight: false,
  },
  {
    id: 'annual' as const,
    title: 'Annual',
    price: PRICE_ANNUAL,
    per: '/year',
    note: `Billed ${PRICE_ANNUAL}/year · Save ₹1,589`,
    playNote: `${FREE_TRIAL_DAYS}-day free trial, then ${PRICE_ANNUAL}/year · Save ₹1,589`,
    // Kept short on purpose: the full "Best value — Save 44%" needs ~291dp
    // beside the price block, and a 360dp phone only has ~288dp of card to
    // give it. The 44% figure is the one recomputed for the ₹1,999 reprice
    // (₹1,999 vs ₹299x12), so it stays; "Best value" is what gives way.
    badge: 'Save 44%',
    cta: 'Get Annual Plan',
    highlight: true,
  },
]

const FEATURES = [
  'Unlimited AI photo & chat logging',
  'Weekly AI recap — your week summarised every Sunday',
  'Full history — beyond the last 7 days',
  'Custom foods & recipes — log your home-cooked dishes',
  'Advanced trends — full weight history, macro breakdown charts',
  'Priority email support',
  'No ads, ever',
]

/**
 * Funnel events for this page. Split out (and Suspense-wrapped) because it
 * reads the URL params, same reason as ReasonBanner.
 */
function PaywallAnalytics() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')

  // The upgrade page itself. Checkout success is `upgrade_completed`.
  useEffect(() => {
    captureEvent('upgrade_viewed', reason ? { reason } : undefined)
  }, [reason])

  // `paywall_viewed` means "was shown the wall", and most gates already emit it
  // where the block happens (camera/chat limits, custom foods, the free-logs
  // interstitial). These reasons have no such gate — the user is redirected or
  // linked straight here — so this page is their only impression. Firing for
  // the others too would double-count every one of them.
  useEffect(() => {
    const source = reason ? PAYWALL_SOURCE_ONLY_HERE[reason] : undefined
    if (source) captureEvent('paywall_viewed', { source })
  }, [reason])

  return null
}

function ReasonBanner() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')
  const reasonCopy = reason ? REASON_COPY[reason] : null
  if (!reasonCopy) return null
  return (
    <div className="rounded-card border border-hairline bg-energy-soft p-4 mb-6 flex items-start gap-3">
      <Lock className="h-5 w-5 text-energy-ink flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-ink">{reasonCopy.title}</p>
        <p className="text-xs text-energy-ink mt-0.5">{reasonCopy.description}</p>
      </div>
    </div>
  )
}

export default function UpgradePage() {
  const { user, profile } = useUser()
  const { startCheckout, loading, playAvailable, playPrices } = useCheckout({ userId: user?.id, userEmail: user?.email })
  const { send: sendVerification, sending: sendingVerification, sent: verificationSent } =
    useSendVerificationLink(user?.email)

  // Signup no longer proves the address, so a subscriber can reach checkout
  // with an inbox nobody can read — no receipt, and a refund or dispute later
  // has no way to reach them. Verification is asked for here specifically
  // because it's the moment the user is most willing to do it: they're about
  // to pay. Play Billing is exempt — Google has already verified that account,
  // and its receipts go through Google, not us.
  const needsVerification =
    !playAvailable && profile !== null && !profile.email_verified_at

  // Projected goal-date teaser (Cal AI's conversion trick) — Pro sells the curve.
  const projection =
    profile && profile.goal !== 'maintain' && profile.current_weight_kg && profile.target_weight_kg
      ? projectGoalDate(profile.current_weight_kg, profile.target_weight_kg, profile.pace_kg_per_week ?? 0.5)
      : null

  return (
    <div className="min-h-screen">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        {/* Contextual banner from gating (Suspense-wrapped because it reads URL params) */}
        <Suspense fallback={null}>
          <PaywallAnalytics />
          <ReasonBanner />
        </Suspense>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft border border-hairline px-3 py-1 text-xs font-semibold text-brand-ink mb-3">
            <Crown className="h-3.5 w-3.5" />
            GetInShape Pro
          </div>
          <h1 className="font-display text-3xl font-bold text-ink">Upgrade to Pro</h1>
          <p className="mt-2 text-sm text-ink-2">Log freely. Get deeper insights when you&apos;re ready.</p>
          <p className="mt-1.5 text-xs font-semibold text-brand-ink">Founder pricing — lock in ₹1,999/year while we&apos;re new.</p>
          {projection && profile && (
            <p className="mt-2 text-[13px] text-ink-2">
              You&apos;re on track for <span className="font-semibold text-ink">{profile.target_weight_kg} kg by ~{formatGoalDate(projection.date)}</span> — see your full curve with Pro.
            </p>
          )}
        </div>

        {/* Features */}
        <div className="rounded-sheet border border-hairline bg-surface p-5 mb-6 shadow-rest">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-brand" />
            <p className="text-sm font-bold text-ink">What you get with Pro</p>
          </div>
          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-ink-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft">
                  <Check className="h-3 w-3 text-brand" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Plans */}
        <div className="space-y-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-sheet border p-5 transition-all ${
                plan.highlight
                  ? 'border-2 border-brand bg-brand-soft shadow-float'
                  : 'border-hairline bg-surface shadow-rest'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">{plan.title}</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-display text-3xl font-bold text-ink tabular-nums">
                      {playPrices[PLAY_PRODUCT_FOR_PLAN[plan.id]] ?? plan.price}
                    </span>
                    <span className="text-sm text-ink-2">{plan.per}</span>
                  </div>
                  <p className="text-xs text-ink-2 mt-0.5">{playAvailable ? plan.playNote : plan.note}</p>
                </div>
                {plan.badge && (
                  // shrink-0 + nowrap: as a plain flex child this pill got
                  // squeezed by the price block and wrapped onto a second line
                  // that spilled past its own rounded edge.
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-energy px-2.5 py-1 text-xs font-bold text-energy-ink">
                    {plan.badge}
                  </span>
                )}
              </div>
              <Button
                variant={plan.highlight ? 'default' : 'outline'}
                size="lg"
                className="mt-4 w-full rounded-full tap-scale"
                onClick={() => needsVerification ? sendVerification('checkout_gate') : startCheckout(plan.id)}
                disabled={!!loading || sendingVerification}
                title={needsVerification ? 'Confirm your email before subscribing' : undefined}
              >
                {needsVerification
                  ? (sendingVerification ? 'Sending…' : verificationSent ? 'Resend confirmation link' : 'Confirm your email first')
                  : (loading === plan.id ? 'Opening checkout...' : plan.cta)}
              </Button>
            </div>
          ))}
        </div>

        {/* Why the buttons say "confirm your email" instead of a price */}
        {needsVerification && (
          <p className="mt-4 text-center text-xs text-ink-2">
            {verificationSent
              ? `We sent a link to ${user?.email}. Tap it, then come back to subscribe.`
              : 'We need a working email to send your receipt and handle refunds. Tap above and we’ll send a confirmation link.'}
          </p>
        )}

        {/* Footer */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-xs text-ink-2">
            {playAvailable
              ? 'Billed securely through Google Play · Cancel anytime'
              : 'Secured by Razorpay · Cancel anytime · 30-day money back'}
          </p>
          <div className="flex justify-center gap-4 text-xs text-ink-2">
            <Link href="/terms" className="underline hover:text-ink">Terms</Link>
            <Link href="/privacy" className="underline hover:text-ink">Privacy</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

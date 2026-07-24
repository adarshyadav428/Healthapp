/**
 * Display strings for the Pro plans, in one place.
 *
 * These are *copy*, not billing values — the amounts actually charged live in
 * the Razorpay plans and the Play Console products. Keeping the strings here
 * matters because the app has more than one paywall (the /upgrade page, the
 * one-time post-log interstitial) and they drifted apart once already: the
 * interstitial quoted the price without ever mentioning the free trial, so the
 * first paywall a new user ever saw was the only one that omitted the single
 * strongest reason to tap.
 *
 * ⚠️ The free trial is a **Play Console offer on both products** — Razorpay
 * charges immediately and has no trial. So trial copy may only be rendered when
 * Play Billing is detected; promising it on the web would be a false claim.
 * See CLAUDE.md, "INR pricing only".
 */

export const PRICE_MONTHLY = '₹299'
export const PRICE_ANNUAL = '₹1,999'

/** Google's minimum allowed free-trial length; Play rejects anything shorter. */
export const FREE_TRIAL_DAYS = 3

/**
 * The price line under the one-time post-log paywall interstitial.
 *
 * `playAvailable` is the Digital Goods API detection — true only inside the
 * installed Play app. Pass `false` (the safe default) while detection is still
 * pending, so a slow probe can never flash trial copy at a web user.
 */
export function paywallPriceLine(playAvailable: boolean): string {
  return playAvailable
    ? `${FREE_TRIAL_DAYS}-day free trial · then ${PRICE_MONTHLY}/month or ${PRICE_ANNUAL}/year`
    : `${PRICE_MONTHLY}/month or ${PRICE_ANNUAL}/year · Cancel anytime`
}

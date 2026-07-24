/**
 * Classifying checkout failures that are really just "the user backed out".
 *
 * Both providers can end a purchase without anything being wrong, but they say
 * so in very different registers. Razorpay calls our own `ondismiss` handler,
 * so we control the wording. Google Play rejects the `PaymentRequest` with
 * Chrome's internal text — observed verbatim on a real device:
 *
 *   "Payment app returned RESULT_CANCELED code. This is how payment apps can
 *    close their activity programmatically."
 *
 * That string reached a user as a red "Checkout failed" toast. Tapping a plan
 * and then backing out of the Play sheet is ordinary behaviour, and it must not
 * look like a crash — least of all in developer jargon on the one screen where
 * we are asking for money.
 *
 * Matching is kept deliberately narrow. A false positive here would disguise a
 * genuine billing failure as a shrug, which is the more expensive mistake: the
 * user would think they had simply changed their mind when in fact we could not
 * charge them.
 */

/** Sentinel the Razorpay path rejects with; also what Play cancellations map to. */
export const CHECKOUT_CANCELLED = 'Checkout cancelled'

// `RESULT_CANCELED` is the Play/Android activity result. `AbortError` is what
// PaymentRequest.show() rejects with when the sheet is dismissed. The bare
// cancel spellings cover both British and American forms, anchored to a word
// boundary so "cancellation fee could not be applied" doesn't match.
const CANCELLATION_PATTERNS = [
  /RESULT_CANCELED/i,
  /AbortError/i,
  /\bcancell?ed\b/i,
  /\bcanceled\b/i,
]

/**
 * True when a failed checkout was the user closing the payment sheet rather
 * than a real error. Callers should stay quiet (or say something neutral)
 * instead of raising an error toast.
 */
export function isCheckoutCancellation(message: string | null | undefined): boolean {
  if (!message) return false
  return CANCELLATION_PATTERNS.some((re) => re.test(message))
}

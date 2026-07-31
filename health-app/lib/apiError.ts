/**
 * What to show a user when an API call fails.
 *
 * The rule is about WHO the message was written for, and the status code is the
 * only honest signal we have:
 *
 *   4xx — we rejected the request on purpose. The message is a validation or
 *         entitlement message, written for a person ("Age cannot exceed 120",
 *         "Custom foods are a Pro feature"). Show it: it tells them what to fix.
 *
 *   5xx — something broke. The message is a Postgres error, a provider's error
 *         text, or a stack-adjacent string. It was written for us. Showing it
 *         leaks internals, reads as a crash, and gives the user nothing to act
 *         on. Swallow it and say something useful instead.
 *
 * This exists because raw `(err as Error).message` was being piped straight into
 * toasts across Settings and the suggestion deck, which is how a user ended up
 * looking at "Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET" in a previous
 * release. lib/checkoutErrors.ts does the equivalent job for the checkout path.
 */

/** Shown when the server failed and we have nothing safe to relay. */
export const GENERIC_ERROR = 'Something went wrong on our side. Please try again.'

export function userFacingApiError(
  status: number,
  serverMessage: string | null | undefined,
  fallback: string = GENERIC_ERROR
): string {
  const message = serverMessage?.trim()
  if (!message) return fallback
  // Deliberately inclusive of 4xx only. A 0/undefined status (network failure,
  // CORS, offline) is not a considered rejection either, so it gets the fallback.
  if (status >= 400 && status < 500) return message
  return fallback
}

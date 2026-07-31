// Client-side Google Play Billing via the Digital Goods API + PaymentRequest.
// Only works inside the installed Play TWA (with Play Billing enabled in the
// TWA build). Everywhere else getPlayBillingService() returns null and callers
// fall back to Stripe.

import { PLAY_PRODUCT_IDS } from './products'

const PLAY_BILLING_METHOD = 'https://play.google.com/billing'

type ItemDetails = {
  itemId: string
  title?: string
  price?: { currency: string; value: string }
}

type DigitalGoodsService = {
  getDetails(itemIds: string[]): Promise<ItemDetails[]>
  listPurchases(): Promise<Array<{ itemId: string; purchaseToken: string }>>
}

type WindowWithDGS = Window & {
  getDigitalGoodsService?: (method: string) => Promise<DigitalGoodsService>
}

/** Resolve the Play Digital Goods service, or null when not in a Play TWA. */
export async function getPlayBillingService(): Promise<DigitalGoodsService | null> {
  if (typeof window === 'undefined') return null
  const w = window as WindowWithDGS
  if (typeof w.getDigitalGoodsService !== 'function') return null
  try {
    return await w.getDigitalGoodsService(PLAY_BILLING_METHOD)
  } catch {
    return null
  }
}

export async function isPlayBillingAvailable(): Promise<boolean> {
  return (await getPlayBillingService()) !== null
}

export type PlayPrice = { productId: string; display: string }

/** Localized price strings from Play, keyed by product id. */
export async function getPlayPrices(): Promise<Record<string, string>> {
  return (await loadPlayBilling()).prices
}

export type PlayBilling = {
  /** We're running inside the Play TWA, so Play is the required payment path. */
  available: boolean
  /** Play returned real products — a purchase sheet would actually open. */
  sellable: boolean
  prices: Record<string, string>
}

/**
 * Resolve Play billing in one pass: whether we're inside the TWA at all, and
 * whether Play will actually sell to us.
 *
 * Those are two different questions, and conflating them is what made a blocked
 * merchant account look like a working checkout. `getDigitalGoodsService` exists
 * as soon as the app runs inside the Play TWA, but the products behind it can
 * still be unsellable — merchant/payments verification pending (India's PA-CB
 * rules route this through BillDesk), a Play outage, or a product id that
 * doesn't match the Console. Play signals that by returning no details for the
 * SKUs, so an empty result is our evidence that a purchase would die.
 *
 * There is deliberately no Razorpay fallback here. Play's payments policy
 * requires Play Billing for digital goods inside an app distributed on Play, so
 * quietly rerouting to another provider would risk the listing itself. Saying
 * "not right now" is the only honest option — see `useCheckout`.
 */
export async function loadPlayBilling(): Promise<PlayBilling> {
  const service = await getPlayBillingService()
  if (!service) return { available: false, sellable: false, prices: {} }

  try {
    const details = await service.getDetails(PLAY_PRODUCT_IDS)
    const prices: Record<string, string> = {}
    for (const d of details) {
      if (d.price) {
        prices[d.itemId] = formatPrice(d.price.currency, d.price.value)
      }
    }
    // A thrown error and an empty list mean the same thing to a buyer, so both
    // land on `sellable: false` rather than only the noisy one.
    return { available: true, sellable: details.length > 0, prices }
  } catch {
    return { available: true, sellable: false, prices: {} }
  }
}

function formatPrice(currency: string, value: string): string {
  const n = Number(value)
  if (Number.isNaN(n)) return value
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n)
  } catch {
    return `${currency} ${Math.round(n)}`
  }
}

type PurchaseResult = { ok: true } | { ok: false; error: string }

// PaymentRequest is standard DOM; the Play-billing `data: { sku }` and the
// `purchaseToken` on the response are Play extensions not in the DOM lib types.
type PaymentResponseLike = {
  details: { purchaseToken?: string }
  complete: (result: 'success' | 'fail') => Promise<void>
}

/**
 * Launch the Play purchase sheet for a product, verify the token server-side,
 * and resolve once the entitlement is recorded. Caller should refresh the
 * subscription query on success.
 */
export async function purchasePlan(productId: string): Promise<PurchaseResult> {
  const service = await getPlayBillingService()
  if (!service) return { ok: false, error: 'Play Billing unavailable' }

  try {
    const request = new PaymentRequest(
      [{ supportedMethods: PLAY_BILLING_METHOD, data: { sku: productId } }],
      // Play ignores this total (it charges the SKU price); a value is still required.
      { total: { label: 'Total', amount: { currency: 'INR', value: '0' } } },
    )

    const response = (await request.show()) as unknown as PaymentResponseLike
    const purchaseToken = response.details?.purchaseToken
    if (!purchaseToken) {
      await response.complete('fail')
      return { ok: false, error: 'No purchase token returned' }
    }

    const res = await fetch('/api/play/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchaseToken, productId }),
    })
    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      await response.complete('fail')
      return { ok: false, error: (body as { error?: string }).error ?? 'Verification failed' }
    }

    await response.complete('success')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

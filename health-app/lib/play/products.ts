// Play subscription product IDs (must match the products created in Play Console).
// NEXT_PUBLIC_ so the same constants resolve on both client and server.

export const PLAY_PRODUCTS = {
  monthly: process.env.NEXT_PUBLIC_PLAY_PRODUCT_MONTHLY || 'pro_monthly',
  annual: process.env.NEXT_PUBLIC_PLAY_PRODUCT_ANNUAL || 'pro_annual',
} as const

export type PlayPlan = 'monthly' | 'annual'

export const PLAY_PRODUCT_IDS: string[] = [PLAY_PRODUCTS.monthly, PLAY_PRODUCTS.annual]

/** Map a Play product id back to our internal plan name. */
export function planForProductId(productId: string): PlayPlan | null {
  if (productId === PLAY_PRODUCTS.monthly) return 'monthly'
  if (productId === PLAY_PRODUCTS.annual) return 'annual'
  return null
}

import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export function getStripeClient(): Stripe {
  if (stripeInstance) return stripeInstance

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('Missing STRIPE_SECRET_KEY')

  stripeInstance = new Stripe(secretKey, {
    apiVersion: '2023-10-16',
    typescript: true,
  })

  return stripeInstance
}

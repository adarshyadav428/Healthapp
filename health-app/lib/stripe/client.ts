import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY
if (!secretKey) throw new Error('Missing STRIPE_SECRET_KEY')

export const stripe = new Stripe(secretKey, {
  apiVersion: '2024-04-10',
  typescript: true,
})

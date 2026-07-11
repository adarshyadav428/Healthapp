import Razorpay from 'razorpay'

let razorpayInstance: Razorpay | null = null

export function getRazorpayClient(): Razorpay {
  if (razorpayInstance) return razorpayInstance

  const key_id = process.env.RAZORPAY_KEY_ID
  const key_secret = process.env.RAZORPAY_KEY_SECRET
  if (!key_id || !key_secret) throw new Error('Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET')

  razorpayInstance = new Razorpay({ key_id, key_secret })
  return razorpayInstance
}

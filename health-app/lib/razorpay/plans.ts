type Plan = 'monthly' | 'annual'

export function planIdFor(plan: Plan): string {
  const id = plan === 'monthly' ? process.env.RAZORPAY_MONTHLY_PLAN_ID : process.env.RAZORPAY_ANNUAL_PLAN_ID
  if (!id) throw new Error(`Missing Razorpay plan id for ${plan}`)
  return id
}

/**
 * Razorpay subscriptions require a bounded total_count (billing cycles) —
 * there's no "forever" option. Use a large-but-finite horizon (10 years) to
 * approximate an indefinite, auto-renewing plan; the subscription can still
 * be cancelled any time via /api/razorpay/cancel.
 */
export function totalCountFor(plan: Plan): number {
  return plan === 'monthly' ? 120 : 10
}

'use client'

import { Button } from '../../components/ui/button'
import { toast } from '../../components/ui/use-toast'

const plans = [
  { id: 'monthly', title: 'Monthly', price: '$9.99/month', highlight: false },
  { id: 'annual', title: 'Annual', price: '$79.99/year', highlight: true },
  { id: 'lifetime', title: 'Lifetime', price: '$199.99', highlight: false },
] as const

type PlanId = (typeof plans)[number]['id']

export default function UpgradePage() {
  const startCheckout = async (plan: PlanId) => {
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (err) {
      toast({ title: 'Checkout failed', description: (err as Error).message, variant: 'error' })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Upgrade to Pro</h1>
          <p className="mt-2 text-sm text-gray-500">Unlock unlimited logging and advanced insights.</p>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            <li>✅ Unlimited food logs (free = 5/day)</li>
            <li>✅ AI meal suggestions (coming soon)</li>
            <li>✅ Recipe builder (coming soon)</li>
            <li>✅ Advanced analytics</li>
            <li>✅ Export to CSV</li>
            <li>✅ No ads, ever</li>
          </ul>
        </div>

        <div className="space-y-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-3xl border ${plan.highlight ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-white'} p-6 shadow-sm`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">{plan.title}</h2>
                {plan.id === 'annual' ? (
                  <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">Save 50%</span>
                ) : null}
              </div>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{plan.price}</p>
              {plan.id === 'annual' ? <p className="text-xs text-gray-500">7-day free trial</p> : null}
              <Button className="mt-4 w-full" onClick={() => startCheckout(plan.id)}>
                {plan.id === 'annual' ? 'Start Annual — Best Value' : plan.id === 'monthly' ? 'Start Monthly' : 'Start Lifetime'}
              </Button>
            </div>
          ))}
        </div>

        <div className="text-center text-xs text-gray-500">
          <button className="underline" onClick={() => toast({ title: 'Restore purchases', description: 'Use your billing portal to manage purchases.' })}>
            Restore purchases
          </button>
          <div className="mt-2 space-x-3">
            <a href="/terms" className="underline">Terms of Service</a>
            <a href="/privacy" className="underline">Privacy Policy</a>
          </div>
        </div>
      </div>
    </div>
  )
}

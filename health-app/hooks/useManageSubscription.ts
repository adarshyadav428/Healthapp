'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../components/ui/use-toast'

/** The subscription shape the manage flow reads (the `select` result of useSubscription). */
type SubscriptionView = {
  provider?: string
  playProductId?: string | null
} | null | undefined

/**
 * "Manage Subscription" orchestration: branches by billing provider —
 * Google Play → the Play subscriptions page, Razorpay → confirm + cancel-at-
 * period-end via /api/razorpay/cancel, legacy Stripe → the Billing Portal.
 * Extracted from SettingsClient so the component is pure presentation.
 * Behaviour (copy, confirm strings, redirects) is intentionally identical.
 */
export function useManageSubscription(subscription: SubscriptionView, profileId: string) {
  const queryClient = useQueryClient()
  const [portalLoading, setPortalLoading] = useState(false)

  const manageSubscription = async () => {
    if (subscription?.provider === 'google_play') {
      const sku = subscription.playProductId
      window.location.href = sku
        ? `https://play.google.com/store/account/subscriptions?sku=${sku}&package=in.co.getinshape.app`
        : 'https://play.google.com/store/account/subscriptions'
      return
    }
    if (subscription?.provider === 'razorpay') {
      const confirmed = window.confirm('Cancel your Pro subscription? You\'ll keep access until the end of the current billing period.')
      if (!confirmed) return
      try {
        setPortalLoading(true)
        const res = await fetch('/api/razorpay/cancel', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        queryClient.invalidateQueries({ queryKey: ['subscription', profileId] })
        toast({ title: 'Cancellation scheduled', description: 'Pro stays active until the end of your billing period.', duration: 4000 })
      } catch (err) {
        toast({ title: 'Could not cancel', description: (err as Error).message, variant: 'error', duration: 4000 })
      } finally {
        setPortalLoading(false)
      }
      return
    }
    try {
      setPortalLoading(true)
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (err) {
      toast({ title: 'Could not open portal', description: (err as Error).message, variant: 'error', duration: 4000 })
      setPortalLoading(false)
    }
  }

  return { manageSubscription, portalLoading }
}

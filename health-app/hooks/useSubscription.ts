'use client'

import { useQuery } from '@tanstack/react-query'
import { getBrowserSupabaseClient } from '../lib/supabase/client'
import type { Subscription } from '../types/index'

export function useSubscription(userId: string | null) {
  return useQuery({
    queryKey: ['subscription', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return null
      const supabase = getBrowserSupabaseClient()
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw new Error(error.message)
      return data as Subscription | null
    },
    select: (data) => {
      const isPro = Boolean(data && (data.status === 'active' || data.status === 'trialing'))
      return {
        subscription: data,
        isPro,
        plan: data?.plan ?? null,
        expiresAt: data?.current_period_end ?? null,
      }
    },
  })
}

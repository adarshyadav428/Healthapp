'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '../components/ui/toaster'
import { LogMilestones } from '../components/milestones/LogMilestones'
import { SentryInit } from '../components/SentryInit'
import { capturePageview, markAppOpened, registerIdentitySuperProps } from '../lib/posthog/client'
import { getBrowserSupabaseClient } from '../lib/supabase/client'
import { isProStatus } from '../lib/subscription'

/**
 * Fires `app_opened` once per app load and starts the clock that
 * `seconds_since_open` is measured against.
 *
 * The emit waits until the session and (for signed-in users) the subscription
 * status have resolved, so the first event carries a correct `is_pro` — the
 * metric is only useful with an accurate denominator. `is_authenticated` /
 * `is_pro` are also registered as super-properties so every subsequent event
 * carries them.
 *
 * Kept as a self-contained session + single-row read (the same shape
 * LogMilestones uses) rather than the full `useUser` hook, so mounting it
 * globally doesn't add a profile fetch and an auth listener to every public
 * page.
 */
function AppOpened() {
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const supabase = getBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return

      const uid = session?.user?.id ?? null
      let isPro = false
      if (uid) {
        const { data } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', uid)
          .maybeSingle()
        if (cancelled) return
        isPro = isProStatus((data as { status?: string } | null)?.status)
      }

      const isAuthenticated = !!uid
      registerIdentitySuperProps({ isAuthenticated, isPro })
      markAppOpened({ isAuthenticated, isPro })
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])
  return null
}

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    const url = searchParams?.size ? `${pathname}?${searchParams.toString()}` : pathname
    capturePageview(url)
  }, [pathname, searchParams])

  return null
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,           // treat data fresh for 1 minute
            refetchOnWindowFocus: false, // don't refetch on every tab-switch
          },
        },
      })
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AppOpened />
        <Suspense fallback={null}>
          <PostHogPageView />
        </Suspense>
        {children}
        <SentryInit />
        <LogMilestones />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '../components/ui/toaster'
import { LogMilestones } from '../components/milestones/LogMilestones'
import { SentryInit } from '../components/SentryInit'
import { capturePageview, markAppOpened } from '../lib/posthog/client'

/**
 * Fires `app_opened` once per app load and starts the clock that
 * `seconds_since_open` is measured against.
 */
function AppOpened() {
  useEffect(() => {
    markAppOpened()
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

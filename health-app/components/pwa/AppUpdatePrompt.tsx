'use client'

import { useEffect, useRef } from 'react'
import { toast } from '../ui/use-toast'

/**
 * Detects a new service worker build installed behind the one already
 * running and prompts a reload. Without this, a session left open across a
 * deploy keeps running the old worker indefinitely — Workbox lets a new one
 * finish installing but leaves it "waiting" until every tab on the old
 * version closes, and nothing here ever asked it to activate.
 *
 * With `cacheOnFrontEndNav` (next.config.js) caching client-side navigations,
 * that stale worker can serve a stale front-end-nav response for a page
 * whose JS has already moved on — which is how FoodHeader's "Today" pill
 * went silently inert the day the 2026-09-12 redesign shipped: the tap fired,
 * the fetch resolved from the old cache, and nothing about it looked like an
 * error.
 */
export function AppUpdatePrompt() {
  const promptedRef = useRef(false)
  const reloadingRef = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let cancelled = false
    let reg: ServiceWorkerRegistration | null = null

    const applyUpdate = (worker: ServiceWorker) => {
      worker.postMessage({ type: 'SKIP_WAITING' })
    }

    const promptUpdate = (worker: ServiceWorker) => {
      if (promptedRef.current) return
      promptedRef.current = true
      toast({
        title: 'Update available',
        description: 'Reload to get the latest version of GetInShape.',
        duration: Infinity,
        action: { label: 'Reload', altText: 'Reload the app', onClick: () => applyUpdate(worker) },
      })
    }

    const onUpdateFound = () => {
      const installing = reg?.installing
      if (!installing) return
      installing.addEventListener('statechange', () => {
        // `controller` already set means this tab was already running a
        // worker, so "installed" here is a genuine update — not the very
        // first install on a fresh visit, which has no controller yet.
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          promptUpdate(installing)
        }
      })
    }

    const onControllerChange = () => {
      if (reloadingRef.current) return
      reloadingRef.current = true
      window.location.reload()
    }

    // An installed PWA is resumed rather than reloaded (KeyboardInset's note
    // on the same lifecycle applies here too), so nothing else re-checks for
    // an update in a long-lived session. Re-check whenever it's foregrounded.
    const onVisible = () => {
      if (document.visibilityState === 'visible') reg?.update().catch(() => {})
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    document.addEventListener('visibilitychange', onVisible)

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration || cancelled) return
      reg = registration
      // A worker already finished installing and is waiting for every tab
      // on the old version to close — exactly the case that otherwise sits
      // silent until the app is force-closed and reopened.
      if (registration.waiting && navigator.serviceWorker.controller) {
        promptUpdate(registration.waiting)
      }
      registration.addEventListener('updatefound', onUpdateFound)
    })

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', onVisible)
      reg?.removeEventListener('updatefound', onUpdateFound)
    }
  }, [])

  return null
}

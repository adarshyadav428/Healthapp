'use client'

import { useEffect, useRef } from 'react'

/**
 * Make the device Back button (and the browser's) close an overlay instead of
 * leaving the screen it is sitting on.
 *
 * Every overlay in this app is React state, not a route, so as far as history
 * is concerned an open camera and a closed one are the same entry. In a browser
 * tab that is merely surprising; inside the Android TWA it is the difference
 * between "dismiss this sheet" and "leave the page I was on", because Back is
 * the primary navigation gesture there and there is no visible browser chrome
 * to explain where you went.
 *
 * The mechanism: push one history entry while the overlay is open and treat the
 * `popstate` that eats it as a close. If the overlay is dismissed some other
 * way (the ✕, Escape, a swipe, or logging the food) the entry we pushed is
 * still sitting there, so it has to be spent — otherwise the user's next Back
 * silently does nothing.
 *
 * Three details are load-bearing:
 *
 *  1. **The count is module-level**, like `use-scroll-lock.ts`, because these
 *     overlays nest — `UnitPicker` opens over `AddFoodModal`. One entry covers
 *     the whole stack; pushing per-overlay would need two Backs to leave one
 *     screen.
 *  2. **Releasing is deferred by a tick, and a new acquire cancels it.**
 *     `reactStrictMode` is on, so in development every effect runs
 *     mount → cleanup → mount synchronously. Without the deferral that cycle
 *     pushes an entry, calls `history.back()`, and the resulting `popstate`
 *     lands on the *second* mount's listener — closing the overlay the instant
 *     it opens. The same deferral makes swapping one overlay for another (the
 *     camera handing a scanned food to `AddFoodModal`) reuse the single entry
 *     instead of flickering through it.
 *  3. **Cleanup only spends the entry if we are still on the page we pushed it
 *     from.** An overlay also unmounts when the user *navigates* — tapping
 *     something that routes away — and calling `history.back()` then drags them
 *     straight back off the page they just opened.
 *
 *     The obvious guard, "is our marker still in `history.state`", does not
 *     work: Next's App Router **copies the existing state object** when it
 *     syncs its tree on `popstate`, so the marker leaks onto entries we never
 *     pushed and the check silently becomes `true` everywhere. Measured — after
 *     one open-and-Back the base entry came back carrying `__gisOverlay: true`.
 *     The pathname at push time is recorded instead, because that is the one
 *     thing a route change must alter and the router cannot copy. The marker is
 *     still written, but only so this is legible in devtools; nothing branches
 *     on it.
 */

const MARKER = '__gisOverlay'

let openCount = 0
let pendingRelease: ReturnType<typeof setTimeout> | null = null
/** Pathname when the entry was pushed; `null` when we hold no entry. */
let pushedPath: string | null = null

function pushEntry() {
  pushedPath = window.location.pathname
  // Keep whatever the router put in `state`: Next's App Router reads its own
  // keys back out of it, and replacing the object wholesale breaks its
  // bookkeeping. The URL is passed explicitly and unchanged so this is a pure
  // history entry, not a navigation.
  const state = { ...(window.history.state as object | null), [MARKER]: true }
  window.history.pushState(state, '', window.location.href)
}

function spendEntry() {
  const path = pushedPath
  pushedPath = null
  if (path === null) return
  if (window.location.pathname !== path) return
  window.history.back()
}

export function useBackDismiss(enabled: boolean, onClose: () => void): void {
  // Read through a ref so a caller passing an inline arrow doesn't tear the
  // history entry down and rebuild it on every render.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (enabled === false) return
    if (typeof window === 'undefined') return

    if (pendingRelease) {
      clearTimeout(pendingRelease)
      pendingRelease = null
    } else if (openCount === 0) {
      pushEntry()
    }
    openCount += 1

    let closedByPop = false
    const onPop = () => {
      closedByPop = true
      // The entry is gone — it is what the browser just consumed.
      pushedPath = null
      onCloseRef.current()
    }
    window.addEventListener('popstate', onPop)

    return () => {
      window.removeEventListener('popstate', onPop)
      openCount -= 1
      if (openCount > 0) return
      // The pop already consumed the entry; spending it again would navigate.
      if (closedByPop) return
      pendingRelease = setTimeout(() => {
        pendingRelease = null
        if (openCount === 0) spendEntry()
      }, 0)
    }
  }, [enabled])
}

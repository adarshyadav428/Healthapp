'use client'

import { useEffect } from 'react'

/**
 * Publishes the on-screen keyboard's height as `--kb-inset` on <html>.
 *
 * iOS never resizes the layout viewport for the keyboard — `window.innerHeight`
 * stays put while `visualViewport.height` shrinks — so a `position: fixed`
 * bottom sheet sits *behind* the keyboard and its form-accessory bar (the
 * ∧ ∨ ✓ strip). Android Chrome behaves the same way under the default
 * `interactive-widget=resizes-visual`, so one variable fixes both platforms.
 *
 * Deliberately NOT solved with `interactive-widget=resizes-content`: that
 * resizes the initial containing block app-wide, shrinking `100vh` on every
 * `min-h-screen` page and floating BottomNav (`fixed inset-x-0 bottom-0`)
 * above the keyboard on every Android text field.
 *
 * `offsetTop` is subtracted because iOS *also* shifts the visual viewport up to
 * reveal the focused field; without it we would lift the sheet twice.
 *
 * The only consumer is sheet positioning — `components/ui/sheet.tsx` offsets by
 * it, and any sheet carrying a `max-h` subtracts it so that lifting also
 * shrinks. Nothing else should read it.
 */
const VAR = '--kb-inset'

/** Below this, the delta is browser-chrome noise (toolbar collapse), not a keyboard. */
const NOISE_PX = 40

export function KeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const root = document.documentElement
    let frame = 0
    let last = -1

    const measure = () => {
      frame = 0
      const raw = window.innerHeight - (vv.height + vv.offsetTop)
      const inset = raw > NOISE_PX ? Math.round(raw) : 0
      if (inset === last) return
      last = inset
      root.style.setProperty(VAR, `${inset}px`)
    }

    // iOS fires a burst of resize/scroll while the keyboard animates; coalesce
    // to one write per frame so we don't thrash style recalculation.
    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(measure)
    }

    measure()
    vv.addEventListener('resize', schedule)
    vv.addEventListener('scroll', schedule)
    window.addEventListener('orientationchange', schedule)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      vv.removeEventListener('resize', schedule)
      vv.removeEventListener('scroll', schedule)
      window.removeEventListener('orientationchange', schedule)
      root.style.removeProperty(VAR)
    }
  }, [])

  return null
}

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

/** Focused elements that summon no keyboard, so cannot justify an inset. */
const NON_TYPING_INPUTS = new Set([
  'checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color', 'image',
])

/**
 * Is a keyboard (or iOS's `<select>` picker wheel, which occupies the same
 * space) actually up?
 *
 * The geometry alone cannot answer this, and trusting it was the bug: *any*
 * shrinking of the visual viewport read as a keyboard. On iOS a rubber-band
 * scroll makes `visualViewport.offsetTop` non-zero, and the measurement below
 * subtracts `offsetTop` — so an overscroll *inflates* the result and published
 * a keyboard that was never there. The sheet then lifted off the bottom edge
 * and stayed there, which is the floating sheet Adarsh reported on iPhone.
 * Android Chrome does not overscroll the visual viewport the same way, which is
 * why it only ever showed up on iOS.
 *
 * A focused text field is a necessary condition for a keyboard, so requiring it
 * makes a phantom inset impossible rather than merely unlikely.
 */
function typingElementFocused(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el || el === document.body) return false
  if (el.isContentEditable) return true
  const tag = el.tagName.toLowerCase()
  if (tag === 'textarea' || tag === 'select') return true
  if (tag !== 'input') return false
  return !NON_TYPING_INPUTS.has((el as HTMLInputElement).type)
}

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
      const inset = typingElementFocused() && raw > NOISE_PX ? Math.round(raw) : 0
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
    // Focus changes are the other half of the fix. Listening only to
    // visualViewport left the inset stuck whenever iOS finished dismissing the
    // keyboard without a final resize at the settled position — the sheet stayed
    // lifted until something else happened to fire one. `focusout` fires before
    // the viewport has grown back, so the focus check alone zeroes it; the
    // trailing resize then agrees rather than being the only chance to notice.
    // Both bubble, so one listener each on the document covers every field.
    document.addEventListener('focusin', schedule)
    document.addEventListener('focusout', schedule)
    // An installed PWA is resumed rather than reloaded, so without this a value
    // measured before backgrounding survives into a session where it is wrong.
    document.addEventListener('visibilitychange', schedule)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      vv.removeEventListener('resize', schedule)
      vv.removeEventListener('scroll', schedule)
      window.removeEventListener('orientationchange', schedule)
      document.removeEventListener('focusin', schedule)
      document.removeEventListener('focusout', schedule)
      document.removeEventListener('visibilitychange', schedule)
      root.style.removeProperty(VAR)
    }
  }, [])

  return null
}

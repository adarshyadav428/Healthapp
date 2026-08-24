'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Counts a number up to `target` on mount (and whenever `target` changes).
 *
 * Extracted from CalorieHeroCard, where it lived alongside a second, subtly
 * different copy in StudioClient — the studio's lacked the safety timeout
 * below, which is the half that actually matters. One implementation now, so
 * a fix to it cannot land in only one of the two places again.
 *
 * The point is that a ring gliding to its new value while the number beside it
 * jumps is worse than neither animating: the eye reads the mismatch as a
 * glitch. Anywhere a bar or ring animates, its numeral should travel with it.
 *
 * @param deps extra values that should restart the animation even when
 *   `target` is unchanged — the studio's replay button, for instance.
 */
export function useCountUp(target: number, duration = 800, deps: unknown[] = []) {
  const [val, setVal] = useState(0)
  const raf = useRef<number>()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(target)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 4)
      setVal(Math.round(target * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
      else clearTimeout(safety)
    }

    // requestAnimationFrame does not always run. Battery saver, a backgrounded
    // tab, and some embedded webviews suppress it entirely — and because this
    // hook starts at 0, the hero then renders a permanent "0 kcal eaten" while
    // the line right below it says "50 kcal over". Observed exactly that during
    // the 2026-07-31 audit in a tab where rAF never fired. The animation is
    // decoration; the number is not, so guarantee the number.
    const safety = setTimeout(() => {
      if (raf.current) cancelAnimationFrame(raf.current)
      setVal(target)
    }, duration + 300)

    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
      clearTimeout(safety)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, ...deps])

  return val
}

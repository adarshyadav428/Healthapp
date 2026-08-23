'use client'

import { useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { decideSwipe, logHref, shiftDateStr } from '../../lib/logDates'
import { istDateStr } from '../../lib/dateUtils'

/**
 * Swipe horizontally anywhere on the diary to move between days (left =
 * next day, right = previous). Gestures that start inside a horizontally
 * scrollable element (chip rows, charts) are ignored so they keep their
 * native scroll, and the gesture must be strongly horizontal so normal page
 * scrolling never navigates. Swiping forward past today is a no-op.
 */
export function SwipeDayNav({ dateStr, children }: { dateStr: string; children: ReactNode }) {
  const router = useRouter()
  const start = useRef<{ x: number; y: number; scrollable: boolean } | null>(null)

  const startedInHorizontalScroller = (target: EventTarget | null): boolean => {
    let el = target instanceof Element ? target : null
    while (el && el !== document.body) {
      if (el.scrollWidth > el.clientWidth + 1) {
        const { overflowX } = getComputedStyle(el)
        if (overflowX === 'auto' || overflowX === 'scroll') return true
      }
      el = el.parentElement
    }
    return false
  }

  return (
    <div
      onTouchStart={(e) => {
        const t = e.touches[0]
        start.current = {
          x: t.clientX,
          y: t.clientY,
          scrollable: startedInHorizontalScroller(e.target),
        }
      }}
      onTouchEnd={(e) => {
        const s = start.current
        start.current = null
        if (!s || s.scrollable) return
        const t = e.changedTouches[0]
        const dir = decideSwipe(t.clientX - s.x, t.clientY - s.y)
        if (!dir) return
        const todayStr = istDateStr()
        if (dir === 'next' && dateStr >= todayStr) return // no future days
        router.push(logHref(shiftDateStr(dateStr, dir === 'next' ? 1 : -1), todayStr))
      }}
    >
      {children}
    </div>
  )
}

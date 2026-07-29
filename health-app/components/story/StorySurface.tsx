'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Story } from './Story'
import type { StoryCard } from './types'
import { captureEvent } from '../../lib/posthog/client'
import { EVENTS, type StorySurface as Surface } from '../../lib/posthog/events'

type Props = {
  surface: Surface
  cards: StoryCard[]
  ctaLabel?: string
  /** Where the CTA sends them. Also where ✕ goes, unless `exitHref` differs. */
  ctaHref: string
  exitHref?: string
  /** Extra props stamped on every event from this surface (plan, provider…). */
  meta?: Record<string, unknown>
}

/**
 * The analytics + navigation wrapper around <Story>.
 *
 * Every story surface shares this so the funnel shape is identical across them
 * and no caller has to remember the event set. <Story> itself stays pure UI.
 *
 * The one subtlety worth preserving: `story_completed` fires on reaching the
 * last card, while `story_cta_clicked` fires on acting. Collapsing them would
 * mean "completed" silently meant "converted", and a story that lands
 * beautifully but doesn't convert would look like a failure.
 */
export function StorySurface({ surface, cards, ctaLabel, ctaHref, exitHref, meta }: Props) {
  const router = useRouter()
  const completed = useRef(false)
  const acted = useRef(false)
  const lastIndex = useRef(0)

  // Kept in a ref so the unmount effect below can read the latest values
  // without re-running (and re-firing `story_shown`) on every render.
  const ctx = useRef({ surface, meta, total: cards.length })
  ctx.current = { surface, meta, total: cards.length }

  useEffect(() => {
    const { surface: s, meta: m, total } = ctx.current
    captureEvent(EVENTS.STORY_SHOWN, { surface: s, cards: total, ...m })

    // Abandonment is only visible on the way out, and it's the honest signal
    // for "was this too long" — the one question this sequence has to answer
    // at a scale too small for a real experiment.
    return () => {
      if (completed.current || acted.current) return
      captureEvent(EVENTS.STORY_ABANDONED, {
        surface: s,
        last_index: lastIndex.current,
        cards: total,
        ...m,
      })
    }
  }, [])

  const onCardView = useCallback((index: number, card: StoryCard) => {
    lastIndex.current = index
    captureEvent(EVENTS.STORY_CARD_VIEWED, {
      surface: ctx.current.surface,
      index,
      card_id: card.id,
      ...ctx.current.meta,
    })
  }, [])

  const onComplete = useCallback(() => {
    completed.current = true
    captureEvent(EVENTS.STORY_COMPLETED, {
      surface: ctx.current.surface,
      cards: ctx.current.total,
      ...ctx.current.meta,
    })
  }, [])

  const onCta = useCallback(() => {
    acted.current = true
    captureEvent(EVENTS.STORY_CTA_CLICKED, {
      surface: ctx.current.surface,
      destination: ctaHref,
      ...ctx.current.meta,
    })
    router.replace(ctaHref)
  }, [ctaHref, router])

  // `replace`, not `push`: a story is a one-time moment, and leaving it in the
  // history stack means Back drops the user into a celebration for something
  // they already did.
  const onClose = useCallback(() => {
    router.replace(exitHref ?? ctaHref)
  }, [router, exitHref, ctaHref])

  return (
    <Story
      cards={cards}
      ctaLabel={ctaLabel}
      onCta={onCta}
      onClose={onClose}
      onCardView={onCardView}
      onComplete={onComplete}
    />
  )
}

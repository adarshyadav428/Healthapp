'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Story } from './Story'
import type { StoryCard } from './types'
import { captureEvent } from '../../lib/posthog/client'
import { EVENTS, type StorySurface as Surface } from '../../lib/posthog/events'
import { shareProgressCard, type ShareCardOption } from '../../lib/shareCard'
import { toast } from '../ui/use-toast'

type Props = {
  surface: Surface
  cards: StoryCard[]
  ctaLabel?: string
  /** Where the CTA sends them. Also where ✕ goes, unless `exitHref` differs. */
  ctaHref: string
  exitHref?: string
  /**
   * When set, the CTA shares this card instead of navigating to `ctaHref`.
   *
   * Plain serializable data, like `cards` themselves, so a Server Component can
   * build it from a stored snapshot and hand it over — Wrapped's "Share my
   * month" used to be a link to /progress, which dropped the user on a page
   * where they had to hunt for a button that shared a streak, not their month.
   */
  shareCard?: ShareCardOption | null
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
export function StorySurface({ surface, cards, ctaLabel, ctaHref, exitHref, shareCard, meta }: Props) {
  const router = useRouter()
  const completed = useRef(false)
  const acted = useRef(false)
  const lastIndex = useRef(0)
  const sharing = useRef(false)

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

  const onCta = useCallback(async () => {
    acted.current = true
    captureEvent(EVENTS.STORY_CTA_CLICKED, {
      surface: ctx.current.surface,
      destination: shareCard ? 'share_card' : ctaHref,
      ...ctx.current.meta,
    })

    if (shareCard) {
      // Story format: this card is going to a status, which is the whole point
      // of offering it here rather than sending the user somewhere else.
      if (sharing.current) return
      sharing.current = true
      try {
        const method = await shareProgressCard(shareCard.data, { format: 'story' })
        captureEvent(EVENTS.PROGRESS_CARD_SHARED, {
          method,
          topic: shareCard.topic,
          format: 'story',
          source: ctx.current.surface,
        })
        if (method === 'downloaded') {
          toast({ title: 'Card saved', description: 'Image downloaded — share it anywhere.', duration: 3000 })
        }
      } catch (err) {
        toast({ title: 'Could not create the card', description: (err as Error).message, variant: 'error' })
      } finally {
        sharing.current = false
      }
      return
    }

    router.replace(ctaHref)
  }, [ctaHref, router, shareCard])

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

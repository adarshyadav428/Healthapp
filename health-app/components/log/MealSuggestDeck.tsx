'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Check, Crown, Loader2, Sparkles } from 'lucide-react'
import { Button } from '../ui/button'
import { captureEvent } from '../../lib/posthog/client'
import { EVENTS } from '../../lib/posthog/events'
import type { Food } from '../../types/index'

type Suggestion = {
  food: Food
  grams: number
  kcal: number
  proteinG: number
  score: number
  isEstimate: boolean
}

type DeckResponse = {
  suggestions: Suggestion[]
  gap: { kcalRemaining: number; proteinRemainingG: number }
  isPro: boolean
  limited: boolean
}

type Props = {
  onClose: () => void
  /** Right-swipe hands the food to the existing add flow — no second log path. */
  onPick: (food: Food) => void
}

/** Past this many pixels a drag counts as a decision rather than a wobble. */
const SWIPE_THRESHOLD = 90

/**
 * "What should I eat?" — the deck.
 *
 * The app has always answered "what did I eat". This answers the question users
 * actually have at 8pm with 600 kcal left, and it's the only Pro benefit that
 * adds a capability rather than removing a wall.
 *
 * Right-swipe deliberately routes into the existing AddFoodModal rather than
 * logging directly: portion choice is where this would otherwise lie to people,
 * and a second logging path is a second place for the numbers to drift.
 */
export function MealSuggestDeck({ onClose, onPick }: Props) {
  const router = useRouter()
  const [data, setData] = useState<DeckResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [drag, setDrag] = useState(0)
  const dragStart = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/foods/suggest')
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'Could not load suggestions')
        if (!cancelled) setData(body)
      })
      .catch((err) => { if (!cancelled) setError((err as Error).message) })
    return () => { cancelled = true }
  }, [])

  const current = data?.suggestions[index]
  const exhausted = !!data && index >= data.suggestions.length

  const advance = useCallback(() => {
    setDrag(0)
    dragStart.current = null
    setIndex((i) => i + 1)
  }, [])

  const dismiss = useCallback(() => {
    if (!current) return
    captureEvent(EVENTS.MEAL_SUGGESTION_SWIPED, {
      direction: 'left', source: current.food.source, kcal: current.kcal,
    })
    // Fire-and-forget: a failed dismissal costs one repeated suggestion later,
    // which is not worth blocking the deck for.
    fetch('/api/foods/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodId: current.food.id }),
    }).catch(() => {})
    advance()
  }, [current, advance])

  const accept = useCallback(() => {
    if (!current) return
    captureEvent(EVENTS.MEAL_SUGGESTION_SWIPED, {
      direction: 'right', source: current.food.source, kcal: current.kcal,
    })
    onPick(current.food)
  }, [current, onPick])

  // Keyboard parity with the swipe, bound to the window so it survives focus
  // landing anywhere — same reasoning as the story engine.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); accept() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); dismiss() }
      else if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [accept, dismiss, onClose])

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientX
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStart.current == null) return
    setDrag(e.clientX - dragStart.current)
  }
  const onPointerUp = () => {
    if (dragStart.current == null) return
    if (drag > SWIPE_THRESHOLD) accept()
    else if (drag < -SWIPE_THRESHOLD) dismiss()
    else { setDrag(0); dragStart.current = null }
  }

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-canvas" role="dialog" aria-modal="true" aria-label="Meal suggestions">
      <div className="flex items-center justify-between px-5" style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">What should I eat?</p>
          {data && (
            <p className="font-display mt-1 text-[22px] font-bold text-ink">
              {Math.max(0, data.gap.kcalRemaining)} kcal left
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Close"
          className="tap-scale flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink-2">
          <X size={16} strokeWidth={2.2} />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        {error && <p className="text-center text-sm text-ink-2">{error}</p>}

        {!data && !error && <Loader2 className="h-6 w-6 animate-spin text-ink-3" />}

        {data && data.suggestions.length === 0 && (
          <p className="max-w-[17rem] text-center text-sm text-ink-2">
            {data.gap.kcalRemaining < 120
              ? 'You’re close to your target for today — nothing worth suggesting.'
              : 'Nothing fits right now. Log a meal and check back.'}
          </p>
        )}

        {/* Ran out. For free users that's the wall, not a bug — say which. */}
        {exhausted && data.suggestions.length > 0 && (
          <div className="text-center">
            {data.limited ? (
              <>
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Crown size={22} strokeWidth={2} />
                </span>
                <h2 className="font-display mt-4 text-[22px] font-bold text-ink">That’s today’s three.</h2>
                <p className="mx-auto mt-2 max-w-[17rem] text-sm text-ink-2">
                  Pro keeps suggesting all day, and tunes every idea to the protein you still owe.
                </p>
                <Button size="lg" className="mt-5 w-full"
                  onClick={() => router.push('/upgrade?reason=meal_suggestions')}>
                  See Pro
                </Button>
              </>
            ) : (
              <p className="max-w-[17rem] text-sm text-ink-2">That’s everything that fits today.</p>
            )}
          </div>
        )}

        {current && (
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="w-full max-w-sm touch-none select-none rounded-sheet bg-surface p-6 shadow-float"
            style={{
              transform: `translateX(${drag}px) rotate(${drag / 28}deg)`,
              transition: dragStart.current == null ? 'transform 220ms cubic-bezier(.22,1,.36,1)' : 'none',
            }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" strokeWidth={2} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Fits your day
              </span>
            </div>

            <h2 className="font-display mt-3 text-[26px] font-bold leading-tight text-ink">
              {current.food.name}
            </h2>
            {current.food.brand && <p className="mt-0.5 text-[13px] text-ink-3">{current.food.brand}</p>}

            <div className="mt-5 flex items-end gap-5">
              <div>
                <p className="font-display text-[34px] font-bold leading-none tabular-nums text-ink">{current.kcal}</p>
                <p className="mt-1 text-[12px] font-medium text-ink-3">kcal</p>
              </div>
              <div>
                <p className="font-display text-[34px] font-bold leading-none tabular-nums text-protein">{current.proteinG}g</p>
                <p className="mt-1 text-[12px] font-medium text-ink-3">protein</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-[13px] font-semibold text-ink-2">{current.grams} g</p>
                <p className="text-[12px] text-ink-3">{current.food.serving_description}</p>
              </div>
            </div>

            {/* Honest about provenance, exactly as search is. A curated row is a
                category baseline, and a deck that hid that would be claiming a
                precision the number doesn't have. */}
            {current.isEstimate && (
              <p className="mt-4 inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink-3">
                📊 Estimated values
              </p>
            )}
          </div>
        )}
      </div>

      {current && (
        <div className="flex items-center justify-center gap-5 px-6"
          style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={dismiss} aria-label="Not this"
            className="tap-scale flex h-14 w-14 items-center justify-center rounded-full border border-hairline bg-surface text-ink-2">
            <X size={22} strokeWidth={2.2} />
          </button>
          <p className="text-[12px] text-ink-3">Swipe or tap</p>
          <button type="button" onClick={accept} aria-label="Log this"
            className="tap-scale flex h-14 w-14 items-center justify-center rounded-full bg-cta-grad text-white"
            style={{ boxShadow: 'var(--shadow-cta)' }}>
            <Check size={22} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  )
}

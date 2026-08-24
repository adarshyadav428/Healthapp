'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, ArrowRight } from 'lucide-react'
import { Button } from '../ui/button'
import type { StoryCard } from './types'

type Props = {
  cards: StoryCard[]
  /** Label for the button on the final card. Omit for a story with no exit action. */
  ctaLabel?: string
  onCta?: () => void
  /** Close/skip. Also fired on Escape and on the ✕. */
  onClose?: () => void
  /** Fires once per card as it becomes visible, including the first. */
  onCardView?: (index: number, card: StoryCard) => void
  /** Fires once, the first time the last card is reached. */
  onComplete?: () => void
}

/**
 * The story engine — a full-screen, tap-advanced card sequence.
 *
 * Shared by the Pro welcome, the monthly Wrapped, the season wrap and the
 * end-of-onboarding plan, so it knows nothing about any of them: callers hand
 * in serializable `StoryCard`s and own every side effect through callbacks.
 *
 * Three rules are load-bearing and should survive future edits:
 *
 *  1. **No auto-advance.** Reading speed varies, and a stat that disappears
 *     before it has been read is worse than a stat that was never shown. It
 *     is also an accessibility failure — there is no correct duration.
 *  2. **No image downloads.** Glyphs are emoji, backgrounds are CSS
 *     gradients. A celebration must not cost a user on a metered connection.
 *  3. **Motion is optional.** Everything animated uses `.story-rise`, which
 *     `prefers-reduced-motion` switches off in app/globals.css.
 */
export function Story({ cards, ctaLabel, onCta, onClose, onCardView, onComplete }: Props) {
  const [index, setIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const completedRef = useRef(false)
  // Card ids already reported, so React's double-invoked effects in dev (and
  // any re-render) can't inflate the funnel with duplicate views.
  const viewedRef = useRef<Set<string>>(new Set())

  const total = cards.length
  const card = cards[index]
  const isLast = index === total - 1

  const advance = useCallback(() => {
    setIndex((i) => Math.min(i + 1, total - 1))
  }, [total])

  const back = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0))
  }, [])

  // Report the card as viewed, and the story as completed on first arrival at
  // the end. `onComplete` fires on reaching the last card rather than on the
  // CTA, so a story that is read fully but exited without acting still counts
  // as read — otherwise "completed" would silently mean "converted".
  useEffect(() => {
    if (!card) return
    if (!viewedRef.current.has(card.id)) {
      viewedRef.current.add(card.id)
      onCardView?.(index, card)
    }
    if (isLast && !completedRef.current) {
      completedRef.current = true
      onComplete?.()
    }
  }, [card, index, isLast, onCardView, onComplete])

  // Focus the container so keys land somewhere sensible on open.
  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  // Bound to the window rather than the container, deliberately. The tap zones
  // disable themselves at the first and last card, and when the focused
  // element becomes disabled the browser drops focus to <body> — at which
  // point a container-level handler stops hearing anything and the story is
  // stuck for keyboard users. This survives focus going anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never hijack typing, in case a caller ever puts a field on a card.
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        // Enter/Space on the CTA or ✕ must activate them, not advance past.
        if (el?.tagName === 'BUTTON' && e.key !== 'ArrowRight') return
        e.preventDefault()
        advance()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        back()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, back, onClose])

  if (!card) return null

  const ember = card.tone === 'ember'
  // On ember the surface is the CTA gradient, which is a fixed material with
  // its own light/dark variants — white text on it matches <Button variant=
  // "default">. On calm we defer to the theme's own ink.
  const fg = ember ? 'text-white' : 'text-ink'
  const fgMuted = ember ? 'text-white/80' : 'text-ink-2'

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Your story"
      className={`fixed inset-0 z-[110] flex flex-col outline-none ${ember ? 'bg-cta-grad' : 'bg-canvas'}`}
    >
      {/* ── Progress segments ──
          Position only, never a timer: with no auto-advance there is nothing
          counting down, and an animated fill would imply otherwise. */}
      <div
        className="relative z-[1] flex gap-1.5 px-4"
        style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}
      >
        {cards.map((c, i) => (
          <div
            key={c.id}
            className={`h-[3px] flex-1 rounded-full ${
              ember
                ? i <= index ? 'bg-white' : 'bg-white/30'
                : i <= index ? 'bg-ink' : 'bg-track'
            }`}
          />
        ))}
      </div>

      <div className="relative z-[1] flex justify-end px-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`tap-scale flex h-9 w-9 items-center justify-center rounded-full ${fgMuted}`}
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>

      {/* ── Tap zones ──
          Real buttons rather than bare divs so the sequence is operable by
          screen reader and keyboard, not just by touch. They sit behind the
          content (z-0) so the CTA and ✕ stay clickable. */}
      <button
        type="button"
        onClick={back}
        aria-label="Previous card"
        disabled={index === 0}
        className="absolute inset-y-0 left-0 z-0 w-1/3 cursor-default disabled:cursor-not-allowed"
      />
      <button
        type="button"
        onClick={advance}
        aria-label="Next card"
        disabled={isLast}
        className="absolute inset-y-0 right-0 z-0 w-2/3 cursor-default disabled:cursor-not-allowed"
      />

      {/* ── Card body ──
          Keyed on card.id so React remounts on every advance and the entrance
          animation replays instead of only running once. */}
      <div
        key={card.id}
        className="pointer-events-none relative z-[1] flex flex-1 flex-col items-center justify-center px-8 text-center"
      >
        {card.glyph && (
          <div className="story-rise text-hero leading-none" aria-hidden="true">
            {card.glyph}
          </div>
        )}

        {card.eyebrow && (
          <p
            className={`story-rise mt-5 text-micro font-semibold uppercase tracking-caps ${fgMuted}`}
            style={{ animationDelay: '60ms' }}
          >
            {card.eyebrow}
          </p>
        )}

        {card.value && (
          <p
            className={`story-rise font-display mt-2 text-hero-lg font-bold leading-[1.05] tabular-nums ${fg}`}
            style={{ animationDelay: '120ms' }}
          >
            {card.value}
          </p>
        )}

        {card.title && (
          <h2
            className={`story-rise font-display mt-2 text-title-lg font-bold leading-tight ${fg}`}
            style={{ animationDelay: '120ms' }}
          >
            {card.title}
          </h2>
        )}

        {card.label && (
          <p
            className={`story-rise mt-1.5 text-body font-semibold ${fgMuted}`}
            style={{ animationDelay: '180ms' }}
          >
            {card.label}
          </p>
        )}

        {card.body && (
          <p
            className={`story-rise mt-4 max-w-[19rem] text-body leading-relaxed ${fgMuted}`}
            style={{ animationDelay: '240ms' }}
          >
            {card.body}
          </p>
        )}

        {card.swaps && card.swaps.length > 0 && (
          <div className="story-rise mt-7 w-full max-w-[17rem] space-y-3" style={{ animationDelay: '300ms' }}>
            {card.swaps.map((swap, i) => (
              <div
                key={swap.before}
                className="story-rise flex items-center justify-between gap-3 text-left"
                style={{ animationDelay: `${340 + i * 90}ms` }}
              >
                <span className={`text-body line-through ${fgMuted}`}>{swap.before}</span>
                <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${fgMuted}`} strokeWidth={2.2} aria-hidden="true" />
                <span className={`text-body font-bold ${fg}`}>{swap.after}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ──
          The CTA only appears on the last card; before that the footer holds
          a hint so the tap affordance is discoverable without a tutorial. */}
      <div
        className="relative z-[1] px-6"
        style={{ paddingBottom: 'calc(28px + env(safe-area-inset-bottom))' }}
      >
        {isLast && ctaLabel ? (
          <Button
            size="lg"
            variant={ember ? 'outline' : 'default'}
            className="w-full"
            onClick={onCta}
          >
            {ctaLabel}
          </Button>
        ) : (
          <p className={`text-center text-caption ${fgMuted}`} aria-hidden="true">
            Tap to continue
          </p>
        )}
      </div>
    </div>
  )
}

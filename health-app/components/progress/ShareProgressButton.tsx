'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Share2, Loader2 } from 'lucide-react'
import {
  buildShareCardOptions,
  buildPlateSplit,
  drawShareCard,
  resolveFonts,
  shareProgressCard,
  kgLostFrom,
  type ShareDeficit,
  type ShareFormat,
} from '../../lib/shareCard'
import { captureEvent } from '../../lib/posthog/client'
import { EVENTS } from '../../lib/posthog/events'
import { Button } from '../ui/button'
import { SegmentedControl } from '../ui/segmented-control'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet'
import { toast } from '../ui/use-toast'
import { cn } from '../../lib/utils'

type Props = {
  streakDays: number
  startWeightKg: number | null
  currentWeightKg: number | null
  /** Recent macro totals — fills the thali's katoris. Omit for a plain plate. */
  macros?: { proteinG: number; carbsG: number; fatG: number } | null
  /**
   * Deficits the server was willing to hand this account. The month is Pro and
   * is withheld server-side, so a free client simply never receives one — this
   * component shows what it was given and gates nothing of its own.
   */
  deficits?: ShareDeficit[]
}

const FORMAT_OPTIONS: { value: ShareFormat; label: string }[] = [
  { value: 'story', label: 'Status' },
  { value: 'square', label: 'Post' },
]

// Hoisted so the default prop is referentially stable — a fresh [] each render
// would invalidate the memo below and redraw the preview on every render.
const NO_DEFICITS: ShareDeficit[] = []

/**
 * "Share your progress" — opens a chooser, then renders the brand card
 * (lib/shareCard.ts) and hands it to the system share sheet (WhatsApp-first on
 * Android), falling back to a PNG download on desktop. Hidden when there's
 * nothing to brag about yet.
 *
 * The chooser exists because the app used to guess: the streak won the hero
 * whenever it was at least a day old, so someone 8 kg down with a 2-day streak
 * was handed a card reading "2". Nobody posts that. The user knows which number
 * they are proud of.
 */
export function ShareProgressButton({
  streakDays,
  startWeightKg,
  currentWeightKg,
  macros,
  deficits = NO_DEFICITS,
}: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [topicIndex, setTopicIndex] = useState(0)
  // Status is the default because it is the stated destination — a square card
  // posted to a WhatsApp status floats in a grey box. Not device-sniffed: that
  // would differ between server and client render.
  const [format, setFormat] = useState<ShareFormat>('story')
  const previewRef = useRef<HTMLCanvasElement>(null)

  const options = useMemo(
    () =>
      buildShareCardOptions({
        streakDays,
        kgLost: kgLostFrom(startWeightKg, currentWeightKg),
        deficit: null,
      }).concat(
        // Each period the server sent becomes its own row, ranked last by the
        // builder either way.
        deficits.flatMap((deficit) =>
          buildShareCardOptions({ streakDays: 0, kgLost: null, deficit })
        )
      ),
    [streakDays, startWeightKg, currentWeightKg, deficits]
  )

  const plate = useMemo(() => buildPlateSplit(macros), [macros])
  const selected = options[Math.min(topicIndex, options.length - 1)]

  // Redraw the preview whenever the choice changes, so what the user sees is
  // literally the file the share sheet is about to receive.
  useEffect(() => {
    if (!open || !selected) return
    let cancelled = false
    document.fonts.ready.then(() => {
      if (cancelled || !previewRef.current) return
      drawShareCard(previewRef.current, selected.data, resolveFonts(), { plate, format })
    })
    return () => {
      cancelled = true
    }
  }, [open, selected, plate, format])

  if (options.length === 0) return null

  const share = async () => {
    if (busy || !selected) return
    setBusy(true)
    try {
      const method = await shareProgressCard(selected.data, { plate, format })
      captureEvent(EVENTS.PROGRESS_CARD_SHARED, {
        method,
        topic: selected.topic,
        format,
        streak: streakDays,
      })
      if (method === 'downloaded') {
        toast({ title: 'Progress card saved', description: 'Image downloaded — share it anywhere.', duration: 3000 })
      }
      setOpen(false)
    } catch (err) {
      toast({ title: 'Could not create the card', description: (err as Error).message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-scale mt-3 flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-brand-ring py-[13px] text-caption font-semibold text-brand-ink"
      >
        <Share2 className="h-4 w-4" strokeWidth={2} />
        Share your progress
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Share your progress</SheetTitle>
            <SheetDescription>Pick the number you want to lead with.</SheetDescription>
          </SheetHeader>

          <div className="mx-auto mb-4 w-full max-w-[180px]">
            <canvas
              ref={previewRef}
              aria-label="Preview of the card you are about to share"
              className="w-full rounded-card bg-surface-2"
              style={{ height: 'auto' }}
            />
          </div>

          {options.length > 1 && (
            <div className="mb-3 space-y-1.5">
              {options.map((option, i) => {
                const active = i === Math.min(topicIndex, options.length - 1)
                return (
                  <button
                    key={option.topic + option.label}
                    type="button"
                    onClick={() => setTopicIndex(i)}
                    aria-pressed={active}
                    className={cn(
                      'tap-scale flex w-full items-baseline justify-between gap-3 rounded-control px-4 py-3 text-left transition-colors',
                      active ? 'bg-brand-soft text-brand-ink' : 'bg-surface-2 text-ink-2'
                    )}
                  >
                    <span className="text-body font-semibold">{option.label}</span>
                    <span className="text-caption tabular-nums">
                      {option.data.hero.value}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <SegmentedControl
            aria-label="Card shape"
            options={FORMAT_OPTIONS}
            value={format}
            onChange={setFormat}
            className="mb-4"
          />

          <Button type="button" onClick={share} disabled={busy} className="w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" strokeWidth={2} />}
            {busy ? 'Creating…' : 'Share'}
          </Button>
        </SheetContent>
      </Sheet>
    </>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Share2, Loader2 } from 'lucide-react'
import type { FoodLog } from '../../types/index'
import {
  buildDayCardData,
  drawDayCard,
  resolveFonts,
  shareDayCard,
  MAX_ITEM_LINES,
  type DayCardLog,
  type ShareFormat,
} from '../../lib/shareCard'
import { captureEvent } from '../../lib/posthog/client'
import { EVENTS } from '../../lib/posthog/events'
import { Button } from '../ui/button'
import { SegmentedControl } from '../ui/segmented-control'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet'
import { toast } from '../ui/use-toast'

const FORMAT_OPTIONS: { value: ShareFormat; label: string }[] = [
  { value: 'story', label: 'Status' },
  { value: 'square', label: 'Post' },
]

/**
 * The date as the card should say it — IST, matching the diary's day boundary
 * (CLAUDE.md: the boundary is IST everywhere). A card headed with a day the
 * user's diary doesn't agree with is worse than no date at all.
 */
function istDateLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Kolkata',
  })
}

/**
 * "Share this day" — renders the day's meals as a menu card and hands it to the
 * system share sheet. Lives on both diary surfaces (the day view on /log and
 * the day drawer on /progress), because that is where a day's meals are.
 *
 * Hidden on an empty day: `buildDayCardData` returns null and there is nothing
 * to post.
 */
export function ShareDayButton({ logs, date }: { logs: FoodLog[]; date: Date }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [format, setFormat] = useState<ShareFormat>('story')
  const previewRef = useRef<HTMLCanvasElement>(null)

  const data = useMemo(
    () =>
      buildDayCardData({
        dateLabel: istDateLabel(date),
        // The budget follows the format: a square has about half the vertical
        // room once the plate and the footer band are paid for.
        maxItemLines: MAX_ITEM_LINES[format],
        logs: logs.map(
          (l): DayCardLog => ({
            meal: l.meal,
            name: l.food?.name ?? null,
            kcal: l.kcal,
            proteinG: l.protein_g,
            carbsG: l.carbs_g,
            fatG: l.fat_g,
          })
        ),
      }),
    [logs, date, format]
  )

  useEffect(() => {
    if (!open || !data) return
    let cancelled = false
    document.fonts.ready.then(() => {
      if (cancelled || !previewRef.current) return
      drawDayCard(previewRef.current, data, resolveFonts(), { format })
    })
    return () => {
      cancelled = true
    }
  }, [open, data, format])

  if (!data) return null

  const share = async () => {
    if (busy) return
    setBusy(true)
    try {
      const method = await shareDayCard(data, { format })
      captureEvent(EVENTS.DAY_CARD_SHARED, {
        method,
        format,
        meals: data.meals.length,
        items: data.meals.reduce((s, m) => s + m.items.length + m.hiddenItems, 0),
      })
      if (method === 'downloaded') {
        toast({ title: 'Day card saved', description: 'Image downloaded — share it anywhere.', duration: 3000 })
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
        Share this day
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Share this day</SheetTitle>
            <SheetDescription>Everything you ate, as a menu.</SheetDescription>
          </SheetHeader>

          <div className="mx-auto mb-4 w-full max-w-[150px]">
            <canvas
              ref={previewRef}
              aria-label="Preview of the day card you are about to share"
              className="w-full rounded-card"
              style={{ height: 'auto' }}
            />
          </div>

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

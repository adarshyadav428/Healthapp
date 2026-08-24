'use client'

import { useMemo, useState } from 'react'
import { Share2, Loader2 } from 'lucide-react'
import { buildShareCardData, buildPlateSplit, shareProgressCard } from '../../lib/shareCard'
import { captureEvent } from '../../lib/posthog/client'
import { toast } from '../ui/use-toast'

type Props = {
  streakDays: number
  startWeightKg: number | null
  currentWeightKg: number | null
  /** Recent macro totals — fills the thali's katoris. Omit for a plain plate. */
  macros?: { proteinG: number; carbsG: number; fatG: number } | null
}

/**
 * "Share progress" — renders the 1080×1080 brand card (lib/shareCard.ts) and
 * hands it to the system share sheet (WhatsApp-first on Android), falling
 * back to a PNG download on desktop. Hidden when there's nothing to brag
 * about yet (no streak, no weight loss).
 */
export function ShareProgressButton({ streakDays, startWeightKg, currentWeightKg, macros }: Props) {
  const [busy, setBusy] = useState(false)
  const data = useMemo(
    () => buildShareCardData({ streakDays, startWeightKg, currentWeightKg }),
    [streakDays, startWeightKg, currentWeightKg]
  )
  const plate = useMemo(() => buildPlateSplit(macros), [macros])

  if (!data) return null

  const share = async () => {
    if (busy) return
    setBusy(true)
    try {
      const method = await shareProgressCard(data, plate)
      captureEvent('progress_card_shared', { method, streak: streakDays })
      if (method === 'downloaded') {
        toast({ title: 'Progress card saved', description: 'Image downloaded — share it anywhere.', duration: 3000 })
      }
    } catch (err) {
      toast({ title: 'Could not create the card', description: (err as Error).message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      disabled={busy}
      className="tap-scale mt-3 flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-brand-ring py-[13px] text-caption font-semibold text-brand-ink disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" strokeWidth={2} />}
      Share your progress
    </button>
  )
}

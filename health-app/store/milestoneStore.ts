import { create } from 'zustand'
import type { LogMilestone } from '../lib/logMilestones'

/**
 * Bridge between the many log flows (search, quick add, camera, chat, copy
 * yesterday) and the single milestone overlay mounted in app/providers.tsx.
 * Callers report the `milestone` field from a successful log response; the
 * overlay decides whether anything should show (lib/logMilestones.ts).
 */
type MilestoneState = {
  pending: LogMilestone | null
  pendingWeightKg: number | null
  pendingStreak: number | null
  setPending: (m: LogMilestone | null) => void
  setPendingWeightKg: (kg: number | null) => void
  setPendingStreak: (days: number | null) => void
}

export const useMilestoneStore = create<MilestoneState>((set) => ({
  pending: null,
  pendingWeightKg: null,
  pendingStreak: null,
  setPending: (pending) => set({ pending }),
  setPendingWeightKg: (pendingWeightKg) => set({ pendingWeightKg }),
  setPendingStreak: (pendingStreak) => set({ pendingStreak }),
}))

/** One-liner for log flows — no-ops when the response carried no milestone. */
export function reportLogMilestone(m?: LogMilestone | null): void {
  if (!m) return
  useMilestoneStore.getState().setPending(m)
}

export function clearPendingMilestone(): void {
  useMilestoneStore.getState().setPending(null)
}

/** Whole-kg weight-loss milestone from /api/weight/add — no-ops on null. */
export function reportWeightMilestone(kg?: number | null): void {
  if (!kg) return
  useMilestoneStore.getState().setPendingWeightKg(kg)
}

export function clearWeightMilestone(): void {
  useMilestoneStore.getState().setPendingWeightKg(null)
}

/** Streak milestone (7/30/100 days), decided client-side on the dashboard. */
export function reportStreakMilestone(days?: number | null): void {
  if (!days) return
  useMilestoneStore.getState().setPendingStreak(days)
}

export function clearStreakMilestone(): void {
  useMilestoneStore.getState().setPendingStreak(null)
}

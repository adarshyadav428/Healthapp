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
  setPending: (m: LogMilestone | null) => void
}

export const useMilestoneStore = create<MilestoneState>((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
}))

/** One-liner for log flows — no-ops when the response carried no milestone. */
export function reportLogMilestone(m?: LogMilestone | null): void {
  if (!m) return
  useMilestoneStore.getState().setPending(m)
}

export function clearPendingMilestone(): void {
  useMilestoneStore.getState().setPending(null)
}

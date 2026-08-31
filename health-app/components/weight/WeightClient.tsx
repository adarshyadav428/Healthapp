'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { WeightLog, Profile } from '../../types/index'
import { WeightStats } from './WeightStats'
import { BmiCard } from './BmiCard'
import { useWeightLogs } from '../../hooks/useWeightLogs'
import { projectGoalDate, formatGoalDate } from '../../lib/projection'
import { formatKg } from '../../lib/formatWeight'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import { Button } from '../ui/button'
import { ProLock } from '../ui/ProLock'
import { Plus, Trash2 } from 'lucide-react'

// Charts and modal — split into their own chunks (recharts ships ~95KB).
const WeightChart    = dynamic(() => import('./WeightChart').then(m => m.WeightChart),       { ssr: false, loading: () => <div className="h-48 rounded-card bg-surface border border-hairline animate-pulse" /> })
const WeightLogModal = dynamic(() => import('./WeightLogModal').then(m => m.WeightLogModal), { ssr: false })

export function WeightClient({
  logs,
  profile,
  atFreeCap = false,
}: {
  logs: WeightLog[]
  profile: Profile
  /** Free account whose weigh-in history has hit the 30-row cap — the chart and
   *  trend stop there, and until now nothing said so. */
  atFreeCap?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { data = logs } = useWeightLogs(profile.id, logs)
  const queryClient = useQueryClient()

  const sorted = [...data].sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
  // Sort descending by measured_at so most-recent entry is always first
  const recentEntries = [...data]
    .sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime())
    .slice(0, 10)

  // Projected goal date from the latest weigh-in (or the onboarding weight).
  const latestWeight = recentEntries[0]?.weight_kg ?? profile.current_weight_kg
  const projection =
    profile.goal !== 'maintain' && latestWeight
      ? projectGoalDate(latestWeight, profile.target_weight_kg, profile.pace_kg_per_week ?? 0.5)
      : null

  const deleteLog = async (id: string) => {
    if (deletingId) return
    try {
      setDeletingId(id)
      const res = await fetch('/api/weight/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      queryClient.setQueryData<WeightLog[]>(['weight-logs', profile.id], (old = []) => old.filter(w => w.id !== id))
      toast({ title: 'Entry deleted', duration: 2000 })
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <WeightStats logs={data} profile={profile} />

      {/* Projected goal date — the "you'll reach X kg by ~date" moment */}
      {projection && (
        <div className="rounded-sheet border border-hairline bg-brand-soft p-4 shadow-rest">
          <p className="text-[14px] font-bold text-brand-ink">
            🎯 On track for {formatKg(profile.target_weight_kg)} kg by ~{formatGoalDate(projection.date)}
          </p>
          <p className="mt-0.5 text-xs text-ink-2">
            At {profile.pace_kg_per_week ?? 0.5} kg/week · about {Math.round(projection.weeks)} weeks to go
          </p>
        </div>
      )}

      {/* BMI card */}
      <BmiCard logs={data} profile={profile} />

      {/* Chart */}
      {sorted.length > 1 && (
        <div className="rounded-sheet border border-hairline bg-surface p-4 shadow-rest">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-2 mb-3">Trend</p>
          <WeightChart logs={sorted} />
          {atFreeCap && (
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-hairline pt-3">
              <p className="text-[12px] text-ink-3">Showing your last 30 weigh-ins</p>
              <ProLock.Chip label="Full history" reason="history" />
            </div>
          )}
        </div>
      )}

      {/* Log weight CTA */}
      <Button
        type="button"
        size="lg"
        onClick={() => setOpen(true)}
        className="w-full gap-2 tap-scale"
      >
        <Plus className="h-5 w-5" />
        Log today&apos;s weight
      </Button>

      {/* Recent entries */}
      {recentEntries.length > 0 && (
        <div className="rounded-sheet border border-hairline bg-surface p-4 shadow-rest space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">Recent entries</p>
          {recentEntries.map((log) => {
            const date = new Date(log.measured_at)
            const label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })
            return (
              <div key={log.id} className="flex items-center justify-between rounded-control bg-surface-2 px-4 py-2.5">
                <span className="text-sm text-ink-2">{label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-ink tabular-nums">{formatKg(log.weight_kg)} kg</span>
                  <button
                    type="button"
                    onClick={() => deleteLog(log.id)}
                    disabled={deletingId === log.id}
                    className="rounded-full p-1 text-ink-2 hover:text-danger hover:bg-danger-soft disabled:opacity-40 transition-colors"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {open ? <WeightLogModal onClose={() => setOpen(false)} defaultWeightKg={latestWeight} /> : null}
    </div>
  )
}

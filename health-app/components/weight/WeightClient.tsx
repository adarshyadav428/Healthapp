'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { WeightLog, Profile } from '../../types/index'
import { WeightStats } from './WeightStats'
import { BmiCard } from './BmiCard'
import { useWeightLogs } from '../../hooks/useWeightLogs'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import { Plus, Trash2 } from 'lucide-react'

// Charts and modal — split into their own chunks (recharts ships ~95KB).
const WeightChart    = dynamic(() => import('./WeightChart').then(m => m.WeightChart),       { ssr: false, loading: () => <div className="h-48 rounded-2xl bg-card border border-border animate-pulse" /> })
const WeightLogModal = dynamic(() => import('./WeightLogModal').then(m => m.WeightLogModal), { ssr: false })

export function WeightClient({ logs, profile }: { logs: WeightLog[]; profile: Profile }) {
  const [open, setOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { data = logs } = useWeightLogs(profile.id, logs)
  const queryClient = useQueryClient()

  const sorted = [...data].sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
  // Sort descending by measured_at so most-recent entry is always first
  const recentEntries = [...data]
    .sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime())
    .slice(0, 10)

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

      {/* BMI card */}
      <BmiCard logs={data} profile={profile} />

      {/* Chart */}
      {sorted.length > 1 && (
        <div className="rounded-3xl border border-gray-100 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Trend</p>
          <WeightChart logs={sorted} />
        </div>
      )}

      {/* Log weight CTA */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-3xl bg-emerald-600 py-4 text-sm font-bold text-white hover:bg-emerald-700 active:scale-[.98] transition-all shadow-md"
      >
        <Plus className="h-5 w-5" />
        Log today&apos;s weight
      </button>

      {/* Recent entries */}
      {recentEntries.length > 0 && (
        <div className="rounded-3xl border border-gray-100 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Recent entries</p>
          {recentEntries.map((log) => {
            const date = new Date(log.measured_at)
            const label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })
            return (
              <div key={log.id} className="flex items-center justify-between rounded-2xl bg-gray-50 dark:bg-slate-800 px-4 py-2.5">
                <span className="text-sm text-muted">{label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-foreground">{log.weight_kg} kg</span>
                  <button
                    type="button"
                    onClick={() => deleteLog(log.id)}
                    disabled={deletingId === log.id}
                    className="rounded-full p-1 text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 transition-colors"
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

      {open ? <WeightLogModal onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

'use client'

import { useState } from 'react'
import type { WeightLog, Profile } from '../../types/index'
import { WeightStats } from './WeightStats'
import { WeightChart } from './WeightChart'
import { WeightLogModal } from './WeightLogModal'
import { useWeightLogs } from '../../hooks/useWeightLogs'
import { Plus } from 'lucide-react'

export function WeightClient({ logs, profile }: { logs: WeightLog[]; profile: Profile }) {
  const [open, setOpen] = useState(false)
  const { data = logs } = useWeightLogs(profile.id, logs)

  const sorted = [...data].sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
  const recentEntries = [...data].slice(0, 7)

  return (
    <div className="space-y-4">
      <WeightStats logs={data} profile={profile} />

      {/* Chart */}
      {sorted.length > 1 && (
        <div className="rounded-3xl border border-gray-100 bg-white/90 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Trend</p>
          <WeightChart logs={data} />
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
        <div className="rounded-3xl border border-gray-100 bg-white/90 p-4 shadow-sm space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Recent entries</p>
          {recentEntries.map((log) => {
            const date = new Date(log.measured_at)
            const label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })
            return (
              <div key={log.id} className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-2.5">
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-sm font-bold text-gray-900">{log.weight_kg} kg</span>
              </div>
            )
          })}
        </div>
      )}

      {open ? <WeightLogModal onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

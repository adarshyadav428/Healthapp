'use client'

import { useState } from 'react'
import type { WeightLog, Profile } from '../../types/index'
import { WeightStats } from './WeightStats'
import { WeightChart } from './WeightChart'
import { WeightLogModal } from './WeightLogModal'
import { BmiCard } from './BmiCard'
import { useWeightLogs } from '../../hooks/useWeightLogs'
import { useUser } from '../../hooks/useUser'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import { Plus, Trash2 } from 'lucide-react'

export function WeightClient({ logs, profile }: { logs: WeightLog[]; profile: Profile }) {
  const [open, setOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { data = logs } = useWeightLogs(profile.id, logs)
  const { user } = useUser()
  const queryClient = useQueryClient()

  const sorted = [...data].sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
  const recentEntries = [...data].slice(0, 10)

  const deleteLog = async (id: string) => {
    if (deletingId) return
    try {
      setDeletingId(id)
      const supabase = getBrowserSupabaseClient()
      const { error } = await supabase.from('weight_logs').delete().eq('id', id).eq('user_id', user?.id ?? '')
      if (error) throw new Error(error.message)
      queryClient.invalidateQueries({ queryKey: ['weight-logs'] })
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
        <div className="rounded-3xl border border-gray-100 bg-white/90 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Trend</p>
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
        <div className="rounded-3xl border border-gray-100 bg-white/90 p-4 shadow-sm space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Recent entries</p>
          {recentEntries.map((log) => {
            const date = new Date(log.measured_at)
            const label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })
            return (
              <div key={log.id} className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-2.5">
                <span className="text-sm text-gray-600">{label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-900">{log.weight_kg} kg</span>
                  <button
                    type="button"
                    onClick={() => deleteLog(log.id)}
                    disabled={deletingId === log.id}
                    className="rounded-full p-1 text-gray-300 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-40 transition-colors"
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

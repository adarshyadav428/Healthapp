'use client'

import dynamic from 'next/dynamic'
import type { Profile, WeightLog } from '../../types/index'
import { WeeklySummary } from '../dashboard/WeeklySummary'
import { StreakBadge } from '../dashboard/StreakBadge'
import Link from 'next/link'
import { Scale, ChevronRight } from 'lucide-react'
import { StreakCalendar } from './StreakCalendar'

// All three of these render recharts SVG charts — defer to keep initial /progress chunk small.
const SkeletonChart     = () => <div className="h-40 rounded-2xl bg-card border border-border animate-pulse" />
const WeightTrendCard   = dynamic(() => import('../dashboard/WeightTrendCard').then(m => m.WeightTrendCard),   { ssr: false, loading: SkeletonChart })
type Props = {
  streak:      number
  weightLogs:  WeightLog[]
  weekLogs:    { kcal: number; logged_at: string }[]
  kcalTarget:  number | null
  profile:     Profile
  loggedDates: string[]
}

export function ProgressClient({ streak, weightLogs, weekLogs, kcalTarget, profile, loggedDates }: Props) {
  const current = weightLogs[0]?.weight_kg ?? null
  const target  = profile.target_weight_kg ?? null
  const toGo    = current !== null && target !== null
    ? Math.abs(current - target).toFixed(1)
    : null

  return (
    <div className="space-y-4">

      {/* ── Goal snapshot ── */}
      {current !== null && target !== null && (
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Goal</p>
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-2xl font-black tabular-nums">{current}</p>
              <p className="text-[10px] text-muted mt-0.5">Current kg</p>
            </div>
            <div className="flex-1 mx-4 text-center">
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{toGo} kg to go</p>
              <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                {(() => {
                  const start  = weightLogs[weightLogs.length - 1]?.weight_kg ?? current
                  const totalNeeded = Math.abs(start - target)
                  const done        = Math.abs(start - current)
                  const pct         = totalNeeded > 0 ? Math.min((done / totalNeeded) * 100, 100) : 0
                  return (
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  )
                })()}
              </div>
              {/* Goal date prediction */}
              {(() => {
                const pace = profile.pace_kg_per_week ?? 0.5
                const remaining = Math.abs(current - target)
                if (remaining < 0.1) return <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1.5">🎉 Goal reached!</p>
                if (pace <= 0) return null
                const daysLeft = Math.round((remaining / pace) * 7)
                const goalDate = new Date()
                goalDate.setDate(goalDate.getDate() + daysLeft)
                const formatted = goalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                return (
                  <p className="text-[10px] text-muted mt-1.5">
                    At current pace · <span className="font-semibold text-foreground">{formatted}</span>
                  </p>
                )
              })()}
            </div>
            <div className="text-center">
              <p className="text-2xl font-black tabular-nums">{target}</p>
              <p className="text-[10px] text-muted mt-0.5">Target kg</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Streak ── */}
      <StreakBadge streak={streak} />

      {/* ── Habit calendar ── */}
      <StreakCalendar loggedDates={loggedDates} />

      {/* ── Weekly summary ── */}
      <WeeklySummary weekLogs={weekLogs} kcalTarget={kcalTarget} />

      {/* ── Weight trend ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Weight</p>
          <Link
            href="/weight"
            className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400"
          >
            Log weight <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {weightLogs.length > 0 ? (
          <WeightTrendCard logs={weightLogs} />
        ) : (
          <Link
            href="/weight"
            className="flex items-center justify-between rounded-2xl bg-card border border-dashed border-border px-4 py-4"
          >
            <div className="flex items-center gap-3">
              <Scale className="h-5 w-5 text-muted" />
              <div>
                <p className="text-sm font-semibold text-foreground">Track your weight</p>
                <p className="text-xs text-muted">See your trend over time</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted" />
          </Link>
        )}
      </div>


      {/* ── Macro targets (reference) ── */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Daily Targets</p>
        <div className="grid grid-cols-2 gap-3">
          <TargetStat label="Calories" value={`${(kcalTarget ?? 0).toLocaleString()} kcal`} />
          <TargetStat label="Protein"  value={`${profile.protein_g_target ?? 0}g`} />
          <TargetStat label="Carbs"    value={`${profile.carbs_g_target ?? 0}g`} />
          <TargetStat label="Fat"      value={`${profile.fat_g_target ?? 0}g`} />
        </div>
        <Link
          href="/settings"
          className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400"
        >
          Edit targets <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

    </div>
  )
}

function TargetStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
      <p className="text-[10px] text-muted font-medium">{label}</p>
      <p className="text-base font-black tabular-nums mt-0.5">{value}</p>
    </div>
  )
}

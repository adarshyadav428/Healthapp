'use client'

import { useState } from 'react'
import { useExerciseLogs } from '../../hooks/useExerciseLogs'
import { useUser } from '../../hooks/useUser'
import { Flame, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

// Common activities with MET values for calorie estimation
const COMMON_ACTIVITIES = [
  { name: 'Walking', met: 3.5 },
  { name: 'Running', met: 9.0 },
  { name: 'Cycling', met: 7.5 },
  { name: 'Swimming', met: 7.0 },
  { name: 'Yoga', met: 2.5 },
  { name: 'Weight training', met: 5.0 },
  { name: 'HIIT', met: 10.0 },
  { name: 'Cricket', met: 5.0 },
  { name: 'Badminton', met: 5.5 },
  { name: 'Football', met: 8.0 },
]

// MET-based estimate: kcal = MET × weight_kg × hours
function estimateCalories(met: number, durationMin: number, weightKg = 70) {
  return Math.round(met * weightKg * (durationMin / 60))
}

type Props = { weightKg?: number }

export function ExerciseLogger({ weightKg = 70 }: Props) {
  const { user } = useUser()
  const { logs, totalCaloriesBurned, add, remove } = useExerciseLogs(user?.id ?? null)

  const [open, setOpen] = useState(false)
  const [activity, setActivity] = useState('')
  const [durationStr, setDurationStr] = useState('30')
  const [caloriesStr, setCaloriesStr] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedMet = COMMON_ACTIVITIES.find(a => a.name === activity)?.met ?? null
  const durationNum = parseInt(durationStr) || 0
  const autoCalories = selectedMet && durationNum > 0
    ? estimateCalories(selectedMet, durationNum, weightKg)
    : null
  const caloriesNum = parseInt(caloriesStr) || autoCalories || 0

  const handleActivitySelect = (name: string, met: number) => {
    setActivity(name)
    if (durationNum > 0) {
      setCaloriesStr(String(estimateCalories(met, durationNum, weightKg)))
    }
  }

  const handleDurationChange = (val: string) => {
    setDurationStr(val)
    if (selectedMet && parseInt(val) > 0) {
      setCaloriesStr(String(estimateCalories(selectedMet, parseInt(val), weightKg)))
    }
  }

  const handleSubmit = async () => {
    if (!activity.trim() || durationNum <= 0 || caloriesNum <= 0) return
    setSaving(true)
    await add(activity.trim(), durationNum, caloriesNum)
    setActivity('')
    setDurationStr('30')
    setCaloriesStr('')
    setOpen(false)
    setSaving(false)
  }

  return (
    <div className="rounded-3xl border border-gray-100 bg-white/90 shadow-sm overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-rose-500" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Exercise</p>
          {totalCaloriesBurned > 0 && (
            <span className="rounded-full bg-rose-100 text-rose-600 text-xs font-bold px-2 py-0.5">
              −{totalCaloriesBurned} kcal burned
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-50">
          {/* Today's exercise logs */}
          {logs.length > 0 && (
            <div className="space-y-1.5 pt-3">
              {logs.map(log => (
                <div key={log.id} className="flex items-center justify-between rounded-2xl bg-rose-50 px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{log.activity}</p>
                    <p className="text-[10px] text-muted">{log.duration_min} min · {log.calories} kcal burned</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(log.id)}
                    className="rounded-full p-1 text-muted hover:text-rose-500 hover:bg-rose-100 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Quick activity chips */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5">Activity</p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_ACTIVITIES.map(a => (
                <button
                  key={a.name}
                  type="button"
                  onClick={() => handleActivitySelect(a.name, a.met)}
                  className={`rounded-xl px-2.5 py-1 text-xs font-semibold border transition-all ${
                    activity === a.name
                      ? 'bg-rose-100 text-rose-700 border-rose-300'
                      : 'bg-gray-50 text-muted border-gray-100 hover:border-rose-200'
                  }`}
                >
                  {a.name}
                </button>
              ))}
            </div>
            {/* Custom activity text input */}
            <input
              type="text"
              value={activity}
              onChange={e => setActivity(e.target.value)}
              placeholder="Or type custom activity…"
              className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-foreground outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all placeholder:text-muted"
            />
          </div>

          {/* Duration + Calories */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5">Duration (min)</p>
              <input
                type="number"
                inputMode="numeric"
                value={durationStr}
                onChange={e => handleDurationChange(e.target.value)}
                onFocus={e => e.target.select()}
                min={1}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-center text-foreground outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
              />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5">
                Kcal burned {autoCalories && !caloriesStr ? '(estimated)' : ''}
              </p>
              <input
                type="number"
                inputMode="numeric"
                value={caloriesStr || (autoCalories ? String(autoCalories) : '')}
                onChange={e => setCaloriesStr(e.target.value)}
                onFocus={e => e.target.select()}
                placeholder={autoCalories ? String(autoCalories) : '0'}
                min={1}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-center text-foreground outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={saving || !activity.trim() || durationNum <= 0 || caloriesNum <= 0}
            onClick={handleSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 py-3 text-sm font-bold text-white hover:bg-rose-600 active:scale-[.98] transition-all disabled:opacity-40 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {saving ? 'Saving…' : `Log ${caloriesNum > 0 ? caloriesNum + ' kcal burned' : 'exercise'}`}
          </button>
        </div>
      )}
    </div>
  )
}

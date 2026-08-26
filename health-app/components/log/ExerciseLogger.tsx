'use client'

import { useState } from 'react'
import { useExerciseLogs } from '../../hooks/useExerciseLogs'
import { useUser } from '../../hooks/useUser'
import { Button } from '../ui/button'
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
    <div className="rounded-sheet bg-surface shadow-air overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4" style={{ color: 'var(--fat)' }} />
          <p className="text-caption font-semibold uppercase tracking-caps text-ink-2">Exercise</p>
          {totalCaloriesBurned > 0 && (
            <span className="rounded-full text-caption font-bold px-2 py-0.5" style={{ background: 'var(--bad-soft)', color: 'var(--fat)' }}>
              −{totalCaloriesBurned} kcal burned
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-ink-2" /> : <ChevronDown className="h-4 w-4 text-ink-2" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-hairline">
          {/* Today's exercise logs */}
          {logs.length > 0 && (
            <div className="space-y-1.5 pt-3">
              {logs.map(log => (
                <div key={log.id} className="flex items-center justify-between rounded-card px-3 py-2" style={{ background: 'var(--bad-soft)' }}>
                  <div>
                    <p className="text-caption font-semibold text-ink">{log.activity}</p>
                    <p className="text-micro text-ink-2">{log.duration_min} min · {log.calories} kcal burned</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(log.id)}
                    className="rounded-full p-1 text-ink-2 hover:text-danger hover:bg-surface transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Quick activity chips */}
          <div>
            <p className="text-micro font-semibold uppercase tracking-caps text-ink-2 mb-1.5">Activity</p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_ACTIVITIES.map(a => (
                <button
                  key={a.name}
                  type="button"
                  onClick={() => handleActivitySelect(a.name, a.met)}
                  className={`rounded-control px-2.5 py-1 text-caption font-semibold border transition-all ${
                    activity === a.name
                      ? 'border-2'
                      : 'bg-surface-2 text-ink-2 border-hairline hover:border-brand-ring'
                  }`}
                  style={activity === a.name ? { background: 'var(--bad-soft)', color: 'var(--fat)', borderColor: 'var(--fat)' } : undefined}
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
              className="mt-2 w-full rounded-control border border-hairline bg-surface-2 px-3 py-2 text-body text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring transition-all placeholder:text-ink-3"
            />
          </div>

          {/* Duration + Calories */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-micro font-semibold uppercase tracking-caps text-ink-2 mb-1.5">Duration (min)</p>
              <input
                type="number"
                inputMode="numeric"
                value={durationStr}
                onChange={e => handleDurationChange(e.target.value)}
                onFocus={e => e.target.select()}
                min={1}
                className="w-full rounded-control border border-hairline bg-surface-2 px-3 py-2 text-body font-bold text-center text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring transition-all"
              />
            </div>
            <div>
              <p className="text-micro font-semibold uppercase tracking-caps text-ink-2 mb-1.5">
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
                className="w-full rounded-control border border-hairline bg-surface-2 px-3 py-2 text-body font-bold text-center text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring transition-all"
              />
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            disabled={saving || !activity.trim() || durationNum <= 0 || caloriesNum <= 0}
            onClick={handleSubmit}
            className="w-full gap-2 tap-scale"
          >
            <Plus className="h-4 w-4" />
            {saving ? 'Saving…' : `Log ${caloriesNum > 0 ? caloriesNum + ' kcal burned' : 'exercise'}`}
          </Button>
        </div>
      )}
    </div>
  )
}

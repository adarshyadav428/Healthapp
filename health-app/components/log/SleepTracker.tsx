'use client'

import { useState } from 'react'
import { Moon, Plus, Trash2, ChevronDown, X, Check, Star } from 'lucide-react'
import { useSleepLogs, sleepDurationMin, type SleepLog } from '../../hooks/useSleepLogs'
import { useUser } from '../../hooks/useUser'

/* ── helpers ──────────────────────────────────────────────── */

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

const QUALITY_LABELS = ['', '😫 Terrible', '😴 Poor', '😐 Fair', '😊 Good', '🌟 Great']
const QUALITY_COLORS = ['', 'text-rose-500', 'text-amber-500', 'text-yellow-500', 'text-emerald-400', 'text-emerald-500']

/* ── Log form ─────────────────────────────────────────────── */

function LogSleepForm({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (data: { sleep_date: string; bedtime: string; wake_time: string; quality?: number }) => Promise<boolean>
}) {
  const today = new Date().toISOString().slice(0, 10)

  // Default bedtime = 10:30 PM yesterday, wake = 6:30 AM today
  const defaultBed = new Date()
  defaultBed.setDate(defaultBed.getDate() - 1)
  defaultBed.setHours(22, 30, 0, 0)

  const defaultWake = new Date()
  defaultWake.setHours(6, 30, 0, 0)

  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [bedtime, setBedtime]   = useState(toLocalInput(defaultBed))
  const [wakeTime, setWakeTime] = useState(toLocalInput(defaultWake))
  const [quality, setQuality]   = useState<number>(4)
  const [saving, setSaving]     = useState(false)

  const durationMin = (() => {
    const b = new Date(bedtime)
    const w = new Date(wakeTime)
    if (isNaN(b.getTime()) || isNaN(w.getTime()) || w <= b) return null
    return Math.round((w.getTime() - b.getTime()) / 60000)
  })()

  const handleSave = async () => {
    if (!durationMin || durationMin <= 0) return
    setSaving(true)
    const ok = await onSave({
      sleep_date: today,
      bedtime: new Date(bedtime).toISOString(),
      wake_time: new Date(wakeTime).toISOString(),
      quality,
    })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-3xl bg-card border-t border-border px-5 pt-5 pb-8 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-base font-bold">Log last night&apos;s sleep</p>
          <button type="button" onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Time inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Bedtime</label>
            <input type="datetime-local" value={bedtime} onChange={(e) => setBedtime(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-foreground outline-none focus:border-violet-400 transition-all" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wide">Wake up</label>
            <input type="datetime-local" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-foreground outline-none focus:border-sky-400 transition-all" />
          </div>
        </div>

        {/* Duration preview */}
        {durationMin !== null && durationMin > 0 ? (
          <div className="rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 px-4 py-2.5 text-center">
            <p className="text-sm font-black text-violet-700 dark:text-violet-300">{fmtDuration(durationMin)}</p>
            <p className="text-[10px] text-muted">sleep duration</p>
          </div>
        ) : durationMin !== null ? (
          <p className="text-xs text-rose-500 text-center">Wake time must be after bedtime</p>
        ) : null}

        {/* Quality stars */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-2">Sleep quality</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((q) => (
              <button key={q} type="button" onClick={() => setQuality(q)}
                className={`flex-1 rounded-xl border py-2.5 text-center transition-all ${
                  quality >= q
                    ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30'
                    : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800'
                }`}>
                <Star className={`h-4 w-4 mx-auto ${quality >= q ? 'fill-violet-500 text-violet-500' : 'text-gray-300 dark:text-slate-600'}`} />
              </button>
            ))}
          </div>
          <p className={`text-xs font-semibold text-center mt-1.5 ${QUALITY_COLORS[quality]}`}>
            {QUALITY_LABELS[quality]}
          </p>
        </div>

        {/* Save */}
        <button type="button" onClick={handleSave} disabled={saving || !durationMin || durationMin <= 0}
          className="w-full rounded-2xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          {saving ? <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="h-4 w-4" />}
          Save sleep
        </button>
      </div>
    </div>
  )
}

/* ── Sleep entry row ──────────────────────────────────────── */

function SleepRow({ log, onDelete }: { log: SleepLog; onDelete: (id: string) => void }) {
  const dur = sleepDurationMin(log)
  const quality = log.quality ?? 0
  const isGood = dur >= 420 // ≥7h
  return (
    <div className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-slate-800 px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-black tabular-nums ${isGood ? 'text-violet-600 dark:text-violet-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {fmtDuration(dur)}
          </span>
          {quality > 0 && (
            <span className={`text-xs font-semibold ${QUALITY_COLORS[quality]}`}>{QUALITY_LABELS[quality]}</span>
          )}
        </div>
        <p className="text-[10px] text-muted">
          {fmtTime(log.bedtime)} → {fmtTime(log.wake_time)} · {new Date(log.sleep_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      </div>
      <button type="button" onClick={() => onDelete(log.id)}
        className="rounded-full p-1 text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/* ── Main card ─────────────────────────────────────────────── */

export function SleepTracker() {
  const { user } = useUser()
  const { history, isLoading, addSleep, deleteSleep } = useSleepLogs(user?.id ?? null)
  const [open, setOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const todayLog = history.find((h) => h.sleep_date === today)

  return (
    <>
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {/* Header */}
        <button type="button" onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted">Sleep</span>
            {todayLog && (
              <span className="rounded-full bg-violet-100 dark:bg-violet-950/40 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">
                {fmtDuration(sleepDurationMin(todayLog))}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!todayLog && !open && (
              <span className="text-[11px] text-muted">Tap to log</span>
            )}
            <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {open && (
          <div className="px-4 pb-4 pt-1 border-t border-border space-y-2">
            {isLoading ? (
              <div className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ) : (
              <>
                {history.length === 0 && (
                  <p className="text-xs text-muted text-center py-2">No sleep logged yet</p>
                )}
                {history.slice(0, 5).map((log) => (
                  <SleepRow key={log.id} log={log} onDelete={deleteSleep} />
                ))}
                <button type="button" onClick={() => setShowForm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-200 dark:border-violet-900/50 py-2.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                  Log sleep
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <LogSleepForm
          onClose={() => setShowForm(false)}
          onSave={addSleep}
        />
      )}
    </>
  )
}

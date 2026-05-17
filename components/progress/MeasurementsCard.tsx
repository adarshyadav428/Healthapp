'use client'

import { useState } from 'react'
import { Ruler, Plus, Trash2, ChevronDown, X, Check } from 'lucide-react'
import { useMeasurements, type MeasurementLog } from '../../hooks/useMeasurements'
import { useUser } from '../../hooks/useUser'

/* ── tiny helpers ─────────────────────────────────────────── */

function fmt(v: number | null) {
  return v !== null ? `${v} cm` : '—'
}

function dateLabel(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/* ── field config ─────────────────────────────────────────── */

const FIELDS: { key: keyof Pick<MeasurementLog, 'waist_cm' | 'chest_cm' | 'hips_cm' | 'arms_cm'>; label: string; color: string }[] = [
  { key: 'waist_cm', label: 'Waist', color: 'text-rose-500 dark:text-rose-400' },
  { key: 'chest_cm', label: 'Chest', color: 'text-blue-500 dark:text-blue-400' },
  { key: 'hips_cm',  label: 'Hips',  color: 'text-violet-500 dark:text-violet-400' },
  { key: 'arms_cm',  label: 'Arms',  color: 'text-amber-500 dark:text-amber-400' },
]

/* ── Add modal ────────────────────────────────────────────── */

type FieldValues = {
  waist_cm: string
  chest_cm: string
  hips_cm: string
  arms_cm: string
  measured_at: string
}

function AddMeasurementModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (data: { waist_cm?: number; chest_cm?: number; hips_cm?: number; arms_cm?: number; measured_at?: string }) => Promise<boolean>
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [vals, setVals] = useState<FieldValues>({
    waist_cm: '',
    chest_cm: '',
    hips_cm: '',
    arms_cm: '',
    measured_at: today,
  })
  const [saving, setSaving] = useState(false)

  const set = (key: keyof FieldValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setVals((v) => ({ ...v, [key]: e.target.value }))

  const parseNum = (s: string) => {
    const n = parseFloat(s)
    return isNaN(n) || n <= 0 ? undefined : n
  }

  const handleSave = async () => {
    const payload = {
      waist_cm: parseNum(vals.waist_cm),
      chest_cm: parseNum(vals.chest_cm),
      hips_cm:  parseNum(vals.hips_cm),
      arms_cm:  parseNum(vals.arms_cm),
      measured_at: vals.measured_at || undefined,
    }
    // At least one measurement required
    if (!payload.waist_cm && !payload.chest_cm && !payload.hips_cm && !payload.arms_cm) return
    setSaving(true)
    const ok = await onSave(payload)
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-3xl bg-card border-t border-border px-5 pt-5 pb-8 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-base font-bold">Log measurements</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Date picker */}
        <div>
          <label className="text-[11px] font-bold text-muted uppercase tracking-wide">Date</label>
          <input
            type="date"
            value={vals.measured_at}
            max={today}
            onChange={set('measured_at')}
            className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-400 transition-all"
          />
        </div>

        {/* Measurement fields */}
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map(({ key, label, color }) => (
            <div key={key}>
              <label className={`text-[11px] font-bold uppercase tracking-wide ${color}`}>{label}</label>
              <div className="mt-1 flex items-center rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2">
                <input
                  type="number"
                  min="1"
                  max="300"
                  step="0.1"
                  value={vals[key]}
                  onChange={set(key)}
                  placeholder="—"
                  className="flex-1 bg-transparent text-sm text-foreground outline-none w-full"
                />
                <span className="text-[11px] text-muted ml-1">cm</span>
              </div>
            </div>
          ))}
        </div>

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save measurements
        </button>
      </div>
    </div>
  )
}

/* ── Delta chip ────────────────────────────────────────────── */

function DeltaChip({ current, prev }: { current: number | null; prev: number | null }) {
  if (current === null || prev === null) return null
  const delta = current - prev
  if (Math.abs(delta) < 0.1) return null
  const down = delta < 0
  return (
    <span className={`text-[10px] font-bold ml-1 ${down ? 'text-emerald-500' : 'text-rose-500'}`}>
      {down ? '▼' : '▲'} {Math.abs(delta).toFixed(1)}
    </span>
  )
}

/* ── History row ───────────────────────────────────────────── */

function HistoryRow({
  log,
  prev,
  onDelete,
}: {
  log: MeasurementLog
  prev: MeasurementLog | undefined
  onDelete: (id: string) => void
}) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-slate-800 px-3 py-2.5 flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-muted mb-1">{dateLabel(log.measured_at)}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {FIELDS.map(({ key, label, color }) => {
            const val = log[key] as number | null
            const pval = prev ? (prev[key] as number | null) : null
            if (val === null) return null
            return (
              <span key={key} className="text-[11px]">
                <span className={`font-bold ${color}`}>{label}</span>{' '}
                <span className="font-semibold text-foreground">{val}</span>
                <DeltaChip current={val} prev={pval} />
              </span>
            )
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(log.id)}
        className="rounded-full p-1 text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex-shrink-0"
        aria-label="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/* ── Main card ─────────────────────────────────────────────── */

export function MeasurementsCard() {
  const { user } = useUser()
  const { measurements, isLoading, addMeasurement, deleteMeasurement } = useMeasurements(user?.id ?? null)
  const [showModal, setShowModal] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const latest = measurements[0] ?? null
  const SHOW_MAX = 3

  return (
    <>
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-indigo-500" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Body Measurements</p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>

        {isLoading ? (
          <div className="px-4 pb-4">
            <div className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        ) : measurements.length === 0 ? (
          <div className="px-4 pb-4">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="w-full flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-5 text-muted hover:border-indigo-400 hover:text-indigo-500 transition-colors"
            >
              <Ruler className="h-5 w-5" />
              <p className="text-xs font-semibold">Track waist, chest, hips & arms</p>
            </button>
          </div>
        ) : (
          <div className="px-4 pb-4 space-y-2">
            {/* Latest summary chips */}
            {latest && (
              <div className="flex flex-wrap gap-2 mb-1">
                {FIELDS.map(({ key, label, color }) => {
                  const val = latest[key] as number | null
                  if (val === null) return null
                  return (
                    <div key={key} className="rounded-xl bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-center min-w-[64px]">
                      <p className={`text-[9px] font-bold uppercase tracking-wide ${color}`}>{label}</p>
                      <p className="text-sm font-black tabular-nums mt-0.5">{fmt(val)}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* History list */}
            <div className="space-y-1.5">
              {measurements
                .slice(0, expanded ? undefined : SHOW_MAX)
                .map((log, idx) => (
                  <HistoryRow
                    key={log.id}
                    log={log}
                    prev={measurements[idx + 1]}
                    onDelete={deleteMeasurement}
                  />
                ))}
            </div>

            {measurements.length > SHOW_MAX && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-muted hover:text-foreground transition-colors pt-1"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                {expanded ? 'Show less' : `Show ${measurements.length - SHOW_MAX} more`}
              </button>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <AddMeasurementModal
          onClose={() => setShowModal(false)}
          onSave={addMeasurement}
        />
      )}
    </>
  )
}

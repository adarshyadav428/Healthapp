'use client'

import { useEffect, useState } from 'react'
import { Timer, Play, Square, ChevronDown } from 'lucide-react'
import { useFasting, type FastingSession } from '../../hooks/useFasting'
import { useUser } from '../../hooks/useUser'

/* ── helpers ──────────────────────────────────────────────── */

function elapsed(startedAt: string): number {
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
}

function fmtHMS(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtDuration(startedAt: string, endedAt: string | null): string {
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const totalMin = Math.floor((end - new Date(startedAt).getTime()) / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ── Circular SVG arc ─────────────────────────────────────── */

function ArcRing({ pct, color }: { pct: number; color: string }) {
  const R = 70
  const circ = 2 * Math.PI * R
  const offset = circ - Math.min(pct / 100, 1) * circ
  return (
    <svg viewBox="0 0 160 160" className="absolute inset-0 w-full h-full -rotate-90">
      {/* Track */}
      <circle cx="80" cy="80" r={R} fill="none" stroke="currentColor" strokeWidth="10"
        className="text-slate-100 dark:text-slate-800" />
      {/* Progress */}
      <circle
        cx="80" cy="80" r={R} fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  )
}

/* ── Active timer view ────────────────────────────────────── */

function ActiveTimer({ session, onStop }: { session: FastingSession; onStop: () => void }) {
  const [secs, setSecs] = useState(() => elapsed(session.started_at))
  const [stopping, setStopping] = useState(false)
  const targetSec = session.target_hours * 3600
  const pct = Math.min((secs / targetSec) * 100, 100)
  const done = secs >= targetSec
  const remaining = Math.max(targetSec - secs, 0)

  useEffect(() => {
    const id = setInterval(() => setSecs(elapsed(session.started_at)), 1000)
    return () => clearInterval(id)
  }, [session.started_at])

  const handleStop = async () => {
    setStopping(true)
    await onStop()
    setStopping(false)
  }

  const arcColor = done ? '#10b981' : pct > 75 ? '#6366f1' : '#6366f1'

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Ring */}
      <div className="relative w-44 h-44">
        <ArcRing pct={pct} color={arcColor} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {done ? (
            <p className="text-2xl">🎉</p>
          ) : (
            <Timer className="h-5 w-5 text-indigo-500 mb-1" />
          )}
          <p className="text-2xl font-black tabular-nums text-foreground">{fmtHMS(secs)}</p>
          <p className="text-[11px] text-muted mt-0.5">
            {done ? 'Goal reached!' : `${Math.round(pct)}% of ${session.target_hours}h`}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-6 text-center">
        <div>
          <p className="text-[10px] text-muted uppercase tracking-wide font-semibold">Started</p>
          <p className="text-sm font-bold text-foreground">
            {new Date(session.started_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted uppercase tracking-wide font-semibold">Target</p>
          <p className="text-sm font-bold text-foreground">{session.target_hours}h fast</p>
        </div>
        <div>
          <p className="text-[10px] text-muted uppercase tracking-wide font-semibold">{done ? 'Exceeded' : 'Remaining'}</p>
          <p className={`text-sm font-bold ${done ? 'text-emerald-500' : 'text-foreground'}`}>
            {done ? `+${fmtHMS(secs - targetSec)}` : fmtHMS(remaining)}
          </p>
        </div>
      </div>

      {/* Stop button */}
      <button
        type="button"
        onClick={handleStop}
        disabled={stopping}
        className="flex items-center gap-2 rounded-2xl border-2 border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 px-6 py-2.5 text-sm font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 disabled:opacity-50 transition-colors"
      >
        <Square className="h-3.5 w-3.5" />
        {stopping ? 'Ending fast...' : 'End fast'}
      </button>
    </div>
  )
}

/* ── Protocol picker ──────────────────────────────────────── */

const PROTOCOLS: { hours: number; label: string; sub: string }[] = [
  { hours: 12, label: '12:12', sub: '12h fast' },
  { hours: 16, label: '16:8',  sub: '16h fast' },
  { hours: 18, label: '18:6',  sub: '18h fast' },
  { hours: 20, label: '20:4',  sub: '20h fast' },
]

function StartView({
  history,
  onStart,
}: {
  history: FastingSession[]
  onStart: (hours: number) => void
}) {
  const [selected, setSelected] = useState(16)
  const [starting, setStarting] = useState(false)

  const handleStart = async () => {
    setStarting(true)
    await onStart(selected)
    setStarting(false)
  }

  return (
    <div className="space-y-4">
      {/* Protocol grid */}
      <div className="grid grid-cols-4 gap-2">
        {PROTOCOLS.map((p) => (
          <button
            key={p.hours}
            type="button"
            onClick={() => setSelected(p.hours)}
            className={[
              'rounded-2xl border-2 py-3 text-center transition-all',
              selected === p.hours
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 hover:border-indigo-300',
            ].join(' ')}
          >
            <p className={`text-sm font-black ${selected === p.hours ? 'text-indigo-700 dark:text-indigo-300' : 'text-foreground'}`}>
              {p.label}
            </p>
            <p className="text-[10px] text-muted mt-0.5">{p.sub}</p>
          </button>
        ))}
      </div>

      {/* Start button */}
      <button
        type="button"
        onClick={handleStart}
        disabled={starting}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        <Play className="h-4 w-4" />
        {starting ? 'Starting...' : `Start ${selected}-hour fast`}
      </button>

      {/* Recent history */}
      {history.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Recent fasts</p>
          {history.slice(0, 3).map((s) => {
            const durSec = s.ended_at
              ? Math.floor((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000)
              : 0
            const pct = Math.min((durSec / (s.target_hours * 3600)) * 100, 100)
            const reached = pct >= 100
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-slate-800 px-3 py-2">
                <span className="text-base">{reached ? '✅' : '⏱️'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    {fmtDuration(s.started_at, s.ended_at)}
                    <span className="text-muted font-normal"> of {s.target_hours}h goal</span>
                  </p>
                  <p className="text-[10px] text-muted">{shortDate(s.started_at)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold ${reached ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {Math.round(pct)}%
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Main card ─────────────────────────────────────────────── */

export function FastingTimer() {
  const { user } = useUser()
  const { activeSession, history, isLoading, startFast, stopFast } = useFasting(user?.id ?? null)
  const [open, setOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="h-8 w-40 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Timer className={`h-4 w-4 ${activeSession ? 'text-indigo-500' : 'text-muted'}`} />
          <span className="text-xs font-bold uppercase tracking-widest text-muted">Intermittent Fasting</span>
          {activeSession && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-5 pt-2 border-t border-border">
          {activeSession ? (
            <ActiveTimer session={activeSession} onStop={stopFast} />
          ) : (
            <StartView history={history} onStart={startFast} />
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Pencil } from 'lucide-react'

// Ring geometry (130×130 SVG)
const R  = 52
const SW = 10
const CX = 65
const CY = 65
const C  = 2 * Math.PI * R   // ≈ 326.7

export function CalorieSummary({
  kcalEaten,
  kcalBurned,
  kcalTarget,
  proteinEaten = 0,
  carbsEaten   = 0,
  fatEaten     = 0,
  proteinTarget = 0,
  carbsTarget   = 0,
  fatTarget     = 0,
}: {
  kcalEaten:     number
  kcalBurned:    number
  kcalTarget:    number
  proteinEaten?: number
  carbsEaten?:   number
  fatEaten?:     number
  proteinTarget?: number
  carbsTarget?:   number
  fatTarget?:     number
}) {
  const [mounted,  setMounted]  = useState(false)
  const [confetti, setConfetti] = useState(false)
  const celebrated = useRef(false)

  const net    = Math.max(kcalEaten - kcalBurned, 0)
  const ratio  = kcalTarget > 0 ? Math.min(net / kcalTarget, 1) : 0
  const offset = mounted ? C * (1 - ratio) : C
  const pct    = Math.round(ratio * 100)
  const isOver = kcalTarget > 0 && net > kcalTarget
  const overAmt = isOver ? net - kcalTarget : 0

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (kcalTarget <= 0) return
    if (net >= kcalTarget && !celebrated.current) {
      celebrated.current = true
      setConfetti(true)
      const t = setTimeout(() => setConfetti(false), 2200)
      return () => clearTimeout(t)
    }
    if (net < kcalTarget) celebrated.current = false
  }, [net, kcalTarget])

  const ringColor = isOver ? '#EF4444' : ratio > 0.9 ? '#F59E0B' : '#EA580C'
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div
      className="relative bg-white rounded-2xl p-4"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      {confetti && <ConfettiBurst />}

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-base font-semibold text-[#1A1A2E]">Today&apos;s Intake</p>
          <p className="text-xs text-[#6B7280] mt-0.5">{today}</p>
        </div>
        <Link
          href="/settings"
          className="flex items-center gap-1.5 rounded-full border border-[#EA580C] px-3 py-1.5 text-xs font-semibold text-[#EA580C] hover:bg-orange-50 transition-colors flex-shrink-0 ml-3 active:scale-95"
        >
          <Pencil className="h-3 w-3" />
          Edit Goals
        </Link>
      </div>

      {/* ── Ring + Macro bars ── */}
      <div className="flex items-center gap-4">
        {/* Ring */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="relative" style={{ width: 130, height: 130 }}>
            <svg
              width={130}
              height={130}
              viewBox="0 0 130 130"
              aria-hidden="true"
              style={{ transform: 'rotate(-90deg)' }}
            >
              {/* Track */}
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F0F0F0" strokeWidth={SW} />
              {/* Progress arc */}
              <circle
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={ringColor}
                strokeWidth={SW}
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={offset}
                style={{
                  transition: mounted
                    ? 'stroke-dashoffset 1.1s cubic-bezier(0.34,1.56,0.64,1), stroke 0.5s ease'
                    : 'none',
                }}
              />
            </svg>

            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
              <span className="text-[18px] leading-none">🔥</span>
              <span className="text-xl font-black tabular-nums leading-none mt-1 text-[#1A1A2E]">
                {net.toLocaleString()}
              </span>
              <span className="text-[9px] text-[#6B7280] mt-0.5 leading-tight">
                / {kcalTarget.toLocaleString()} kcal
              </span>
            </div>
          </div>

          {/* % of goal or over */}
          {isOver ? (
            <p className="text-[10px] font-semibold text-[#EF4444] mt-1">
              +{overAmt.toLocaleString()} kcal over
            </p>
          ) : (
            <p className="text-[10px] font-semibold text-[#EA580C] mt-1">
              {pct}% of daily goal
            </p>
          )}
        </div>

        {/* Macro bars */}
        <div className="flex-1 min-w-0 space-y-3">
          <MacroBar icon="💪" label="Protein" value={proteinEaten} target={proteinTarget} color="#3B82F6" />
          <MacroBar icon="🌾" label="Carbs"   value={carbsEaten}   target={carbsTarget}   color="#F59E0B" />
          <MacroBar icon="💧" label="Fat"     value={fatEaten}     target={fatTarget}     color="#EF4444" />
        </div>
      </div>
    </div>
  )
}

function MacroBar({
  icon, label, value, target, color,
}: {
  icon: string; label: string; value: number; target: number; color: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <span className="text-xs leading-none">{icon}</span>
          <span className="text-xs text-[#6B7280]">{label}</span>
        </div>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>
          {value}g{' '}
          <span className="font-normal text-[#9CA3AF]">/ {target}g</span>
        </span>
      </div>
      <div className="h-[6px] rounded-full overflow-hidden bg-[#F0F0F0]">
        <div
          className="h-full rounded-full"
          style={{
            width: mounted ? `${pct}%` : '0%',
            background: color,
            transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        />
      </div>
    </div>
  )
}

function ConfettiBurst() {
  const pieces = [
    { left: '10%', delay: '0ms',   color: '#EA580C' },
    { left: '20%', delay: '80ms',  color: '#F59E0B' },
    { left: '32%', delay: '160ms', color: '#22C55E' },
    { left: '44%', delay: '40ms',  color: '#3B82F6' },
    { left: '56%', delay: '120ms', color: '#EA580C' },
    { left: '68%', delay: '200ms', color: '#EF4444' },
    { left: '78%', delay: '60ms',  color: '#F59E0B' },
    { left: '88%', delay: '140ms', color: '#22C55E' },
  ]
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10 rounded-2xl">
      {pieces.map((p) => (
        <span
          key={p.left}
          className="confetti-piece"
          style={{ left: p.left, animationDelay: p.delay, background: p.color }}
        />
      ))}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'

const R = 84
const CX = 102
const CY = 102
const CIRCUMFERENCE = 2 * Math.PI * R

interface Props {
  eaten: number
  target: number
  kcalLeft: number
}

export function CalorieRing({ eaten, target, kcalLeft }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const pct = target > 0 ? Math.min(eaten / target, 1) : 0
  const offset = CIRCUMFERENCE * (1 - (mounted ? pct : 0))
  const isOver = eaten > target

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 204, height: 204 }}>
        <svg
          width={204}
          height={204}
          viewBox="0 0 204 204"
          style={{ filter: 'drop-shadow(0 6px 14px rgba(251,116,69,.30))' }}
        >
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFB36B" />
              <stop offset="100%" stopColor="#FB7445" />
            </linearGradient>
            <linearGradient id="ringGradOver" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF6B6B" />
              <stop offset="100%" stopColor="#E0554D" />
            </linearGradient>
          </defs>

          {/* Track */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="#F4ECE5"
            strokeWidth={14}
          />

          {/* Progress arc */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={isOver ? 'url(#ringGradOver)' : 'url(#ringGrad)'}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform={`rotate(-90, ${CX}, ${CY})`}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>

        {/* Center labels */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[13px] font-semibold text-muted">Eaten</span>
          <span
            className="tabular-nums font-bold text-ink leading-none"
            style={{ fontSize: 52, letterSpacing: '-1.5px', lineHeight: 0.92 }}
          >
            {eaten.toLocaleString('en-IN')}
          </span>
          <span className="text-[12.5px] font-medium text-muted mt-1">
            of {target.toLocaleString('en-IN')} kcal
          </span>
        </div>
      </div>

      {/* Below ring */}
      <p className="text-[15px] font-medium text-ink mt-1 tabular-nums">
        <span className="font-bold">
          {Math.abs(kcalLeft).toLocaleString('en-IN')}
        </span>{' '}
        kcal {kcalLeft >= 0 ? 'left today' : 'over goal'}
      </p>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Droplets } from 'lucide-react'

const GLASS_ML = 250
const MAX_GLASSES = 10
const MAX_ML = GLASS_ML * MAX_GLASSES

function todayKey() {
  return `water-${new Date().toISOString().slice(0, 10)}`
}

const QUICK_ADD = [
  { label: '+250', sub: 'glass', ml: 250 },
  { label: '+500', sub: '2 glass', ml: 500 },
  { label: '+1L', sub: 'bottle', ml: 1000 },
  { label: '+1.5L', sub: 'big', ml: 1500 },
]

export function HomeWaterTracker({ targetMl = 2500 }: { targetMl?: number }) {
  const [waterMl, setWaterMl] = useState(0)
  const [sprung, setSprung] = useState<number | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(todayKey())
    if (stored) setWaterMl(parseInt(stored, 10))
  }, [])

  function save(ml: number) {
    const clamped = Math.max(0, Math.min(ml, MAX_ML))
    setWaterMl(clamped)
    localStorage.setItem(todayKey(), String(clamped))
  }

  function toggleGlass(idx: number) {
    // idx is 0-based; glass N (1-based) fills up to N*250ml
    const glassN = idx + 1
    const currentGlasses = Math.ceil(waterMl / GLASS_ML)
    setSprung(idx)
    setTimeout(() => setSprung(null), 400)
    if (currentGlasses === glassN) {
      // tapping the last filled glass → unfill it
      save((glassN - 1) * GLASS_ML)
    } else {
      save(glassN * GLASS_ML)
    }
  }

  function quickAdd(ml: number) {
    save(waterMl + ml)
  }

  const filledGlasses = Math.min(Math.ceil(waterMl / GLASS_ML), MAX_GLASSES)

  return (
    <div
      className="rounded-[22px] p-[22px]"
      style={{
        background: 'linear-gradient(180deg, #EFF7FE 0%, #fff 55%)',
        border: '1px solid #DDEBF8',
        boxShadow: '0 8px 26px -14px rgba(47,111,224,.22)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-[10px] flex-shrink-0"
            style={{ background: '#DCEDFB' }}
          >
            <Droplets className="h-4 w-4" style={{ color: '#2F6FE0' }} strokeWidth={2} />
          </div>
          <div>
            <p className="text-[14.5px] font-semibold text-ink leading-none">Water</p>
            <p className="text-[11.5px] font-medium text-muted mt-[2px]">
              {filledGlasses} of {MAX_GLASSES} glasses
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[18px] font-bold text-ink tabular-nums">
            {waterMl.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] font-medium text-muted">
            {' '}/ {targetMl.toLocaleString('en-IN')} ml
          </span>
        </div>
      </div>

      {/* Glass dots */}
      <div className="flex gap-[6px] mb-4">
        {Array.from({ length: MAX_GLASSES }, (_, i) => {
          const filled = i < filledGlasses
          const isSpring = sprung === i
          return (
            <button
              key={i}
              onClick={() => toggleGlass(i)}
              className="flex-1 aspect-square rounded-[8px]"
              style={{
                border: `1.5px solid ${filled ? '#2F6FE0' : '#D5E4F4'}`,
                background: filled
                  ? 'linear-gradient(160deg, #4F93EC, #2F6FE0)'
                  : '#EEF4FB',
                boxShadow: filled ? '0 3px 7px -2px rgba(47,111,224,.5)' : 'none',
                transform: isSpring ? 'scale(0.86)' : 'scale(1)',
                transition: 'transform 0.4s cubic-bezier(.34,1.56,.64,1), background 0.2s, box-shadow 0.2s',
              }}
              aria-label={`Glass ${i + 1}`}
            />
          )
        })}
      </div>

      {/* Quick-add buttons */}
      <div className="grid grid-cols-4 gap-2">
        {QUICK_ADD.map(({ label, sub, ml }) => (
          <button
            key={label}
            onClick={() => quickAdd(ml)}
            className="flex flex-col items-center py-2 rounded-[13px] tap-scale"
            style={{
              border: '1px solid #EFEDE6',
              background: '#FAFAF7',
            }}
          >
            <span className="text-[13.5px] font-bold text-ink">{label}</span>
            <span className="text-[10px] font-medium text-muted">{sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

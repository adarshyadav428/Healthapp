'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = { dateStr: string /* YYYY-MM-DD in UTC */ }

function todayUtcStr() {
  const t = new Date()
  return [t.getUTCFullYear(), String(t.getUTCMonth() + 1).padStart(2, '0'), String(t.getUTCDate()).padStart(2, '0')].join('-')
}

function formatDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  const todayStr = todayUtcStr()
  const y = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - 1))
  const yStr = [y.getUTCFullYear(), String(y.getUTCMonth() + 1).padStart(2, '0'), String(y.getUTCDate()).padStart(2, '0')].join('-')
  if (dateStr === todayStr) return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
  if (dateStr === yStr) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function shiftDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day + days))
  return [d.getUTCFullYear(), String(d.getUTCMonth() + 1).padStart(2, '0'), String(d.getUTCDate()).padStart(2, '0')].join('-')
}

export function FoodHeader({ dateStr }: Props) {
  const router = useRouter()
  const todayStr = todayUtcStr()
  const isToday = dateStr === todayStr

  const go = (target: string) => router.push(target === todayStr ? '/log' : `/log?date=${target}`)

  return (
    <div className="flex items-center justify-between pt-2">
      <div>
        <p className="text-[13px] font-medium text-ink-3">{formatDisplay(dateStr)}</p>
        <h1 className="font-display mt-[3px] text-[24px] font-bold tracking-[-0.02em] text-ink">Food</h1>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => go(shiftDate(dateStr, -1))}
          aria-label="Previous day"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface tap-scale"
          style={{ boxShadow: 'var(--shadow-air)' }}
        >
          <ChevronLeft className="h-[15px] w-[15px] text-ink" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => !isToday && go(shiftDate(dateStr, 1))}
          disabled={isToday}
          aria-label="Next day"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface tap-scale disabled:opacity-35"
          style={{ boxShadow: 'var(--shadow-air)' }}
        >
          <ChevronRight className="h-[15px] w-[15px] text-ink" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

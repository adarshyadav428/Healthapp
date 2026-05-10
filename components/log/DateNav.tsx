'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

type Props = { dateStr: string /* YYYY-MM-DD in UTC */ }

function formatDisplay(dateStr: string): string {
  // dateStr is YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))

  const todayUtc = new Date()
  const todayStr = [
    todayUtc.getUTCFullYear(),
    String(todayUtc.getUTCMonth() + 1).padStart(2, '0'),
    String(todayUtc.getUTCDate()).padStart(2, '0'),
  ].join('-')

  const yesterdayUtc = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate() - 1))
  const yesterdayStr = [
    yesterdayUtc.getUTCFullYear(),
    String(yesterdayUtc.getUTCMonth() + 1).padStart(2, '0'),
    String(yesterdayUtc.getUTCDate()).padStart(2, '0'),
  ].join('-')

  if (dateStr === todayStr) return 'Today'
  if (dateStr === yesterdayStr) return 'Yesterday'

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getUTCFullYear() !== todayUtc.getUTCFullYear() ? 'numeric' : undefined,
    timeZone: 'UTC',
  })
}

function shiftDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day + days))
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export function DateNav({ dateStr }: Props) {
  const router = useRouter()

  const todayUtc = new Date()
  const todayStr = [
    todayUtc.getUTCFullYear(),
    String(todayUtc.getUTCMonth() + 1).padStart(2, '0'),
    String(todayUtc.getUTCDate()).padStart(2, '0'),
  ].join('-')

  const isToday = dateStr === todayStr
  const isFuture = dateStr > todayStr

  const go = (target: string) => {
    if (target === todayStr) {
      router.push('/log')
    } else {
      router.push(`/log?date=${target}`)
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 mb-4">
      <button
        type="button"
        onClick={() => go(shiftDate(dateStr, -1))}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 text-muted hover:text-foreground hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => !isToday && go(todayStr)}
        className="flex items-center gap-1.5 text-sm font-bold text-foreground"
      >
        <CalendarDays className="h-3.5 w-3.5 text-muted" />
        {formatDisplay(dateStr)}
      </button>

      <button
        type="button"
        onClick={() => !isFuture && go(shiftDate(dateStr, 1))}
        disabled={isToday}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 text-muted hover:text-foreground hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next day"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

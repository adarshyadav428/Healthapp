'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import { toast } from '../ui/use-toast'
import {
  DEFAULT_REMINDER_HOUR,
  REMINDER_HOURS,
  formatReminderHour,
  normaliseReminderHour,
} from '../../lib/reminderSchedule'

/**
 * Choose when the daily reminder arrives.
 *
 * One fixed evening nudge was wrong for a large share of users — someone who
 * eats at 21:30 is being asked to log a meal they haven't had, and someone who
 * logs over breakfast never needed an evening prompt. A mistimed reminder is
 * not neutral: it is what makes people turn notifications off, and permission
 * revocation is the risk the whole push budget exists to manage.
 *
 * The list comes from lib/reminderSchedule rather than being spelled out here,
 * because which hours can actually be honoured is a property of the scheduler,
 * not of this dropdown. Offering an hour that would silently never fire is the
 * one failure worth designing against.
 *
 * Optimistic, with a rollback: the select shows the new value immediately, and
 * puts it back if the write fails. A picker that snaps back with no explanation
 * is how users learn their settings are decorative.
 */
export function ReminderHourPicker({ initialHour }: { initialHour: number }) {
  const router = useRouter()
  const [hour, setHour] = useState(() => normaliseReminderHour(initialHour))
  const [saving, setSaving] = useState(false)

  const save = async (next: number) => {
    const previous = hour
    setHour(next)
    setSaving(true)
    try {
      const res = await fetch('/api/profile/reminder-hour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hour: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save your reminder time.')
      router.refresh()
    } catch (err) {
      setHour(previous)
      toast({
        title: 'Not saved',
        description: (err as Error).message,
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-hairline pt-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-control bg-brand-soft">
          <Clock className="h-4 w-4 text-brand" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Remind me at</p>
          <p className="text-xs text-ink-2">Only if you haven&apos;t logged by then</p>
        </div>
      </div>

      <select
        value={hour}
        disabled={saving}
        onChange={(e) => save(Number(e.target.value))}
        aria-label="Reminder time"
        className="flex-shrink-0 rounded-control border border-hairline bg-surface px-3 py-2 text-base font-medium text-ink disabled:opacity-50"
      >
        {REMINDER_HOURS.map((h) => (
          <option key={h} value={h}>
            {formatReminderHour(h)}
          </option>
        ))}
        {/* A stored hour outside the offered list (set before the list changed)
            would otherwise render as a blank select showing the wrong time. */}
        {!REMINDER_HOURS.includes(hour) && (
          <option value={hour}>{formatReminderHour(DEFAULT_REMINDER_HOUR)}</option>
        )}
      </select>
    </div>
  )
}

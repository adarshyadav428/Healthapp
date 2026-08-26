'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { toast } from '../ui/use-toast'
import { isPushSupported, getCurrentPushSubscription, subscribeToPush, unsubscribeFromPush } from '../../lib/push/client'

export function PushNotificationToggle() {
  const [supported, setSupported] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false)
      setLoading(false)
      return
    }
    getCurrentPushSubscription()
      .then((sub) => setEnabled(!!sub))
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async () => {
    if (toggling) return
    setToggling(true)
    try {
      if (enabled) {
        await unsubscribeFromPush()
        setEnabled(false)
      } else {
        const result = await subscribeToPush()
        if (result.ok) {
          setEnabled(true)
        } else {
          toast({ title: 'Could not enable reminders', description: result.error, variant: 'error' })
        }
      }
    } catch {
      toast({ title: 'Something went wrong', description: 'Please try again.', variant: 'error' })
    } finally {
      setToggling(false)
    }
  }

  if (!loading && !supported) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-control bg-surface-2">
          <Bell className="h-4 w-4 text-ink-3" strokeWidth={1.75} />
        </span>
        <p className="text-xs text-ink-3">Push notifications aren&apos;t supported in this browser.</p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-control bg-brand-soft">
          <Bell className="h-4 w-4 text-brand" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Meal reminders</p>
          <p className="text-xs text-ink-2">A daily nudge if you haven&apos;t logged yet</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={handleToggle}
        disabled={loading || toggling}
        className="relative h-7 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-50"
        style={{ background: enabled ? 'var(--brand)' : 'var(--surface-2)', border: enabled ? 'none' : '1px solid var(--hairline)' }}
      >
        <span
          className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-rest transition-transform duration-200 ease-out"
          style={{ transform: enabled ? 'translateX(23px)' : 'translateX(3px)' }}
        />
      </button>
    </div>
  )
}

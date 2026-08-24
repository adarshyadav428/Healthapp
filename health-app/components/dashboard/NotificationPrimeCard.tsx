'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { toast } from '../ui/use-toast'
import { captureEvent } from '../../lib/posthog/client'
import { isPushSupported, getCurrentPushSubscription, subscribeToPush } from '../../lib/push/client'

const DISMISS_KEY = 'gis.notifPrimeDismissed'

function dismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
}
function setDismissed(): void {
  try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* noop */ }
}

/**
 * Benefit-framed reminders prompt, shown on the dashboard once the user has
 * logged at least once (parent gates on that). Primes notifications in context
 * instead of leaving the only opt-in buried in Settings (P1-17). One-time,
 * dismissible, and never shown if reminders are already on.
 */
export function NotificationPrimeCard() {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    if (!isPushSupported() || dismissed()) return
    getCurrentPushSubscription().then((sub) => {
      if (active && !sub) setVisible(true)
    })
    return () => { active = false }
  }, [])

  if (!visible) return null

  const enable = async () => {
    if (busy) return
    setBusy(true)
    const result = await subscribeToPush()
    if (result.ok) {
      captureEvent('reminders_enabled', { source: 'dashboard_prime' })
      toast({ title: 'Reminders on 🔔', description: "We'll nudge you if you haven't logged by evening.", duration: 2800 })
      setDismissed()
      setVisible(false)
    } else {
      toast({ title: 'Could not enable reminders', description: result.error, variant: 'error' })
      setBusy(false)
    }
  }

  const close = () => {
    captureEvent('reminders_prime_dismissed')
    setDismissed()
    setVisible(false)
  }

  return (
    <div className="mt-4 flex items-start gap-3 rounded-card bg-surface p-4" style={{ boxShadow: 'var(--shadow-air)' }}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft">
        <Bell className="h-[18px] w-[18px] text-brand" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-ink">Never break your streak</p>
        <p className="mt-0.5 text-caption text-ink-2">Get a friendly reminder if you haven&apos;t logged by evening.</p>
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="rounded-full bg-ink px-4 py-1.5 text-caption font-semibold text-canvas tap-scale disabled:opacity-50"
            style={{ boxShadow: 'var(--cta-shadow)' }}
          >
            {busy ? 'Enabling…' : 'Turn on reminders'}
          </button>
          <button type="button" onClick={close} className="text-caption font-medium text-ink-3 tap-scale">Not now</button>
        </div>
      </div>
      <button type="button" onClick={close} aria-label="Dismiss" className="shrink-0 rounded-full p-1 text-ink-3 tap-scale">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

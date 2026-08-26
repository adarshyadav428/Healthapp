'use client'

import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { parseA2hsState, shouldShowA2hs, type A2hsState } from '../../lib/a2hs'
import { captureEvent } from '../../lib/posthog/client'
import { useHomeSlot } from '../dashboard/HomeSlot'

// Chrome's non-standard event — not in lib.dom.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'gis.a2hs' // device-level, deliberately not per-user

function persist(patch: NonNullable<A2hsState>) {
  try {
    const prev = parseA2hsState(localStorage.getItem(STORAGE_KEY))
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...patch }))
  } catch {
    /* noop */
  }
}

/**
 * Add-to-Home-Screen card for mobile-web users. Renders nothing until Chrome
 * fires beforeinstallprompt (which never happens in the installed PWA/TWA or
 * on iOS Safari), so there's zero layout shift for everyone else. Decision
 * logic in lib/a2hs.ts; 30-day dismissal cooldown.
 */
export function InstallPromptCard() {
  const [visible, setVisible] = useState(false)
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari's non-standard flag
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)

    const onPrompt = (e: Event) => {
      e.preventDefault() // suppress Chrome's mini-infobar; we show our card instead
      promptRef.current = e as BeforeInstallPromptEvent
      let state: A2hsState = null
      try {
        state = parseA2hsState(localStorage.getItem(STORAGE_KEY))
      } catch {
        /* fail open */
      }
      setVisible(shouldShowA2hs({ canPrompt: true, isStandalone, state }))
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  // See components/dashboard/HomeSlot.tsx — one attention card on Home.
  const wins = useHomeSlot('install', visible)
  if (!wins) return null

  const install = async () => {
    const deferred = promptRef.current
    if (!deferred) return
    setVisible(false)
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') {
      persist({ installed: true })
      captureEvent('a2hs_accepted')
    } else {
      persist({ lastDismissedAt: new Date().toISOString() })
      captureEvent('a2hs_declined')
    }
    promptRef.current = null
  }

  const dismiss = () => {
    persist({ lastDismissedAt: new Date().toISOString() })
    captureEvent('a2hs_dismissed')
    setVisible(false)
  }

  return (
    <div className="mt-4 rounded-card bg-surface p-4" style={{ boxShadow: 'var(--shadow-air)' }}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Download size={18} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink">Install GetInShape</p>
          <p className="mt-0.5 text-caption leading-snug text-ink-2">
            Add it to your home screen — full-screen, faster, one tap away.
          </p>
        </div>
      </div>
      <div className="mt-3.5 flex gap-2.5">
        <button
          type="button"
          onClick={install}
          className="tap-scale flex h-10 flex-1 items-center justify-center rounded-control bg-brand-soft text-body font-semibold text-brand-ink"
        >
          Install
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="tap-scale flex h-10 flex-1 items-center justify-center rounded-control bg-surface-2 text-body font-semibold text-ink-2"
        >
          Not now
        </button>
      </div>
    </div>
  )
}

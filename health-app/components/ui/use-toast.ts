import { create } from 'zustand'
import {
  HAPTIC_PATTERNS,
  shouldVibrate,
  parseHapticPreference,
  type HapticPattern,
} from '../../lib/haptics'

export type ToastVariant = 'default' | 'success' | 'error'

/** Where the three-way haptic preference lives, matching the `gis.` convention. */
export const HAPTIC_PREFERENCE_KEY = 'gis.haptics'

/**
 * The toast is the one thing every confirmed action already passes through —
 * all six logging paths, the combo logger, copy-yesterday — so it is also the
 * only place haptics need wiring. When useInstantLog lands it inherits this
 * rather than adding a seventh copy.
 *
 * Errors deliberately stay silent: buzzing someone's hand to tell them they
 * failed is a punishment, not feedback.
 */
const HAPTIC_FOR_VARIANT: Record<ToastVariant, HapticPattern | null> = {
  default: 'tap',
  success: 'success',
  error: null,
}

function fireHaptic(variant: ToastVariant) {
  if (typeof window === 'undefined') return
  const pattern = HAPTIC_FOR_VARIANT[variant]
  if (!pattern) return

  let preference
  try {
    preference = parseHapticPreference(localStorage.getItem(HAPTIC_PREFERENCE_KEY))
  } catch {
    // Storage can throw in a locked-down webview. Fall back to the default.
    preference = parseHapticPreference(null)
  }

  const ok = shouldVibrate({
    supported: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    preference,
  })
  if (!ok) return

  // Chrome throws if the document has never been interacted with; a toast
  // always follows a user action, but a stray throw must not kill the toast.
  try {
    navigator.vibrate([...HAPTIC_PATTERNS[pattern]])
  } catch {
    /* no-op */
  }
}

export type ToastOptions = {
  title: string
  description?: string
  variant?: ToastVariant
  /** Auto-dismiss delay in ms. Defaults to 4000. */
  duration?: number
  /** Optional CTA rendered inside the toast, e.g. linking to an upgrade page. */
  action?: { label: string; altText: string; onClick: () => void }
}

type ToastItem = ToastOptions & { id: string }

type ToastState = {
  toasts: ToastItem[]
  add: (toast: ToastOptions) => void
  dismiss: (id: string) => void
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }],
    })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export function useToast() {
  return useToastStore()
}

export function toast(options: ToastOptions) {
  fireHaptic(options.variant ?? 'default')
  useToastStore.getState().add(options)
}

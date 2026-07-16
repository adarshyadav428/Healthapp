export const A2HS_COOLDOWN_DAYS = 30

export type A2hsState = {
  /** ISO timestamp of the last "Not now" (or a declined native prompt). */
  lastDismissedAt?: string
  /** Chrome's prompt was accepted — never ask again on this device. */
  installed?: boolean
} | null

/**
 * Show the "install GetInShape" card only when the browser actually handed
 * us a beforeinstallprompt event (so tapping Install always works), we're not
 * already running installed (standalone PWA or the Play TWA), and the user
 * hasn't accepted or dismissed within the cooldown. Device-level, not
 * per-user — installation is a device concern. Pure for tests; the component
 * owns localStorage and event capture.
 */
export function shouldShowA2hs(args: {
  canPrompt: boolean
  isStandalone: boolean
  state: A2hsState
  now?: Date
}): boolean {
  const { canPrompt, isStandalone, state, now = new Date() } = args
  if (!canPrompt || isStandalone) return false
  if (state?.installed) return false
  if (state?.lastDismissedAt) {
    const dismissed = new Date(state.lastDismissedAt).getTime()
    if (Number.isFinite(dismissed)) {
      const days = (now.getTime() - dismissed) / 86_400_000
      if (days < A2HS_COOLDOWN_DAYS) return false
    }
  }
  return true
}

/** Parse the stored JSON defensively — malformed data counts as "no state". */
export function parseA2hsState(raw: string | null): A2hsState {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as A2hsState
    return null
  } catch {
    return null
  }
}

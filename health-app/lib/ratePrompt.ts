export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=in.co.getinshape.app'

export const RATE_PROMPT_MIN_STREAK = 3
export const RATE_PROMPT_COOLDOWN_DAYS = 90

export type RatePromptState = {
  /** ISO timestamp of the last "Not now". */
  lastDismissedAt?: string
  /** User tapped through to the Play Store — never ask again. */
  rated?: boolean
} | null

/**
 * Show the "rate us on Google Play" card only when the user is (a) clearly
 * enjoying the app — streak of RATE_PROMPT_MIN_STREAK+ days, (b) actually in
 * the installed Play build (a web user can't leave a Play rating), and
 * (c) hasn't rated or dismissed within the cooldown. Pure so it's testable;
 * the component owns localStorage.
 */
export function shouldShowRatePrompt(args: {
  streakDays: number
  inPlayTwa: boolean
  state: RatePromptState
  now?: Date
}): boolean {
  const { streakDays, inPlayTwa, state, now = new Date() } = args
  if (streakDays < RATE_PROMPT_MIN_STREAK) return false
  if (!inPlayTwa) return false
  if (state?.rated) return false
  if (state?.lastDismissedAt) {
    const dismissed = new Date(state.lastDismissedAt).getTime()
    if (Number.isFinite(dismissed)) {
      const days = (now.getTime() - dismissed) / 86_400_000
      if (days < RATE_PROMPT_COOLDOWN_DAYS) return false
    }
  }
  return true
}

/** Parse the stored JSON defensively — malformed data counts as "no state". */
export function parseRatePromptState(raw: string | null): RatePromptState {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as RatePromptState
    return null
  } catch {
    return null
  }
}

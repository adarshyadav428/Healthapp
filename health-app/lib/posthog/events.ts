/**
 * Canonical analytics event catalog — the single source of truth for every
 * PostHog event name and its shape (retention/habit-loop build spec, Phase 0).
 *
 * Names are FROZEN here so call sites can't drift. If a screen wants to fire an
 * event, it imports the name from `EVENTS` (or a typed helper in ./client /
 * ./server) rather than passing a bare string. Anything not listed here is not
 * a sanctioned event.
 *
 * Events whose feature doesn't exist yet (freezes, day-complete) are declared
 * here but fired by the phase that builds the feature — see the block at the
 * bottom.
 */

export const EVENTS = {
  // lifecycle
  APP_OPENED: 'app_opened',
  // onboarding + signup
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  SIGNUP_COMPLETED: 'signup_completed',
  // logging (the core loop)
  FIRST_FOOD_LOGGED: 'first_food_logged',
  FOOD_LOGGED: 'food_logged',
  MEAL_TEMPLATE_SAVED: 'meal_template_saved',
  MEAL_TEMPLATE_LOGGED: 'meal_template_logged',
  // streak (fired by Phase 4 when the mechanic is built)
  STREAK_INCREMENTED: 'streak_incremented',
  STREAK_FROZEN: 'streak_frozen',
  STREAK_BROKEN: 'streak_broken',
  DAY_COMPLETED: 'day_completed',
  // recap
  WEEKLY_RECAP_VIEWED: 'weekly_recap_viewed',
  // monetization
  PAYWALL_VIEWED: 'paywall_viewed',
  UPGRADE_COMPLETED: 'upgrade_completed',

  /* --- product events that predate the spec and remain useful --- */
  // checkout funnel (C15) — `upgrade_completed` is the success end of this
  UPGRADE_VIEWED: 'upgrade_viewed',
  CHECKOUT_ATTEMPTED: 'checkout_attempted',
  CHECKOUT_FAILED: 'checkout_failed',
  PLAY_TOKEN_REPLAY_BLOCKED: 'play_token_replay_blocked',
  // AI logging quality
  AI_SCAN_COMPLETED: 'ai_scan_completed',
  AI_ESTIMATE_CORRECTED: 'ai_estimate_corrected',
  // celebration / milestone surfaces
  FIRST_LOG_CELEBRATION_SHOWN: 'first_log_celebration_shown',
  WEIGHT_MILESTONE_SHOWN: 'weight_milestone_shown',
  STREAK_MILESTONE_SHOWN: 'streak_milestone_shown',
  PROGRESS_CARD_SHARED: 'progress_card_shared',
  // install / notification / rating prompts
  A2HS_ACCEPTED: 'a2hs_accepted',
  A2HS_DECLINED: 'a2hs_declined',
  A2HS_DISMISSED: 'a2hs_dismissed',
  REMINDERS_ENABLED: 'reminders_enabled',
  REMINDERS_PRIME_DISMISSED: 'reminders_prime_dismissed',
  RATE_PROMPT_CLICKED: 'rate_prompt_clicked',
  RATE_PROMPT_DISMISSED: 'rate_prompt_dismissed',
} as const

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS]

/**
 * How a food log was initiated — the `method` prop on `food_logged`.
 * `chat` covers the text-AI logging path (the spec enumerates photo_scan for
 * the camera; chat is its text sibling and gets its own value rather than being
 * mislabelled).
 */
export const FOOD_LOG_METHODS = [
  'search',
  'log_again',
  'meal_template',
  'copy_yesterday',
  'photo_scan',
  'chat',
  'quick_add',
  'manual',
] as const

export type FoodLogMethod = (typeof FOOD_LOG_METHODS)[number]

export function isFoodLogMethod(value: unknown): value is FoodLogMethod {
  return typeof value === 'string' && (FOOD_LOG_METHODS as readonly string[]).includes(value)
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/** The `source` prop on `paywall_viewed`. */
export type PaywallSource =
  | 'free_logs'
  | 'camera_scan_limit'
  | 'chat_scan_limit'
  | 'custom_foods'
  | 'history_limit'
  | 'recap_end_card'

/**
 * Canonical analytics event catalog — the single source of truth for every
 * PostHog event name and its shape (retention/habit-loop build spec, Phase 0).
 *
 * Names are FROZEN here so call sites can't drift. If a screen wants to fire an
 * event, it imports the name from `EVENTS` (or a typed helper in ./client /
 * ./server) rather than passing a bare string. Anything not listed here is not
 * a sanctioned event.
 *
 * Every name in here has a live emit site. If you add one, wire it in the same
 * pass — a declared-but-never-fired event reads as "we measure this" in code
 * review and silently answers nothing. The four streak events sat unfired from
 * the day they were written until 2026-08-23.
 */

export const EVENTS = {
  // lifecycle
  APP_OPENED: 'app_opened',
  // onboarding + signup
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  SIGNUP_COMPLETED: 'signup_completed',
  // Deferred email verification. Signup no longer blocks on an inbox round
  // trip, so proof of ownership is chased later — these two measure whether
  // that chase actually lands.
  EMAIL_VERIFICATION_SENT: 'email_verification_sent',
  EMAIL_VERIFIED: 'email_verified',
  EMAIL_VERIFY_PROMPT_DISMISSED: 'email_verify_prompt_dismissed',
  // logging (the core loop)
  FIRST_FOOD_LOGGED: 'first_food_logged',
  FOOD_LOGGED: 'food_logged',
  MEAL_TEMPLATE_SAVED: 'meal_template_saved',
  MEAL_TEMPLATE_LOGGED: 'meal_template_logged',
  // Streak lifecycle. Emitted server-side from the log routes via
  // lib/streakEvents.ts — a streak is recomputed pure from logs, so the only
  // moment anything can be *notified* that it changed is when a log lands.
  STREAK_INCREMENTED: 'streak_incremented',
  STREAK_FROZEN: 'streak_frozen',
  // Not `streak_broken`: a break is an absence, observable only on the return
  // (or never, for the churned users who matter most). See lib/streakEvents.ts.
  STREAK_RESTARTED: 'streak_restarted',
  DAY_COMPLETED: 'day_completed',
  // recap
  WEEKLY_RECAP_VIEWED: 'weekly_recap_viewed',
  // monetization
  PAYWALL_VIEWED: 'paywall_viewed',
  // The other outcome of a paywall impression — turns `paywall_viewed` from a
  // raw counter into a two-branch funnel. Fired on an explicit dismiss
  // (Maybe later / ✕ / backdrop), not on a navigation-away.
  PAYWALL_DISMISSED: 'paywall_dismissed',
  UPGRADE_COMPLETED: 'upgrade_completed',
  // Subscription lifecycle. The funnel used to end at purchase *intent*
  // (`upgrade_completed` fires the moment a checkout returns) — it could never
  // see whether a Play trial converted to paid, or whether anyone stayed. These
  // close that gap. All emitted server-side from the billing routes/webhooks.
  TRIAL_STARTED: 'trial_started',
  TRIAL_CONVERTED: 'trial_converted',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_REFUNDED: 'subscription_refunded',

  /* --- product events that predate the spec and remain useful --- */
  // checkout funnel (C15) — `upgrade_completed` is the success end of this
  UPGRADE_VIEWED: 'upgrade_viewed',
  CHECKOUT_ATTEMPTED: 'checkout_attempted',
  CHECKOUT_FAILED: 'checkout_failed',
  PLAY_TOKEN_REPLAY_BLOCKED: 'play_token_replay_blocked',
  // AI logging quality
  AI_SCAN_COMPLETED: 'ai_scan_completed',
  AI_ESTIMATE_CORRECTED: 'ai_estimate_corrected',
  // story surfaces (Pro welcome, Wrapped, onboarding plan).
  // `*_completed` means "read to the last card", NOT "acted" — the CTA has its
  // own event, so a story that lands but doesn't convert stays visible in the
  // funnel instead of being scored as a failure.
  STORY_SHOWN: 'story_shown',
  STORY_CARD_VIEWED: 'story_card_viewed',
  STORY_COMPLETED: 'story_completed',
  STORY_ABANDONED: 'story_abandoned',
  STORY_CTA_CLICKED: 'story_cta_clicked',
  // Meal suggestions — "What should I eat?", which the app had never answered.
  MEAL_SUGGESTIONS_VIEWED: 'meal_suggestions_viewed',
  MEAL_SUGGESTION_SWIPED: 'meal_suggestion_swiped',
  // Search had NO telemetry at all, which made the catalogue's biggest weakness
  // invisible: a user typing a dish we don't carry looks identical to a user
  // who never searched. Deliberately only the failures — a per-keystroke event
  // would be mostly noise, and the actionable question is "which foods are
  // people asking for that we don't have".
  FOOD_SEARCH_NO_RESULTS: 'food_search_no_results',
  // Streak Rescue — the Pro object. Distinct from the free auto-freeze.
  STREAK_RESCUE_OFFERED: 'streak_rescue_offered',
  STREAK_RESCUE_USED: 'streak_rescue_used',
  // celebration / milestone surfaces
  FIRST_LOG_CELEBRATION_SHOWN: 'first_log_celebration_shown',
  WEIGHT_MILESTONE_SHOWN: 'weight_milestone_shown',
  STREAK_MILESTONE_SHOWN: 'streak_milestone_shown',
  PROGRESS_CARD_SHARED: 'progress_card_shared',
  /** The day's meals shared as a menu card. Distinct from the stat card above:
   *  one is "look how far I've come", the other is "look what I ate today". */
  DAY_CARD_SHARED: 'day_card_shared',
  TARGET_SUGGESTION_ACCEPTED: 'target_suggestion_accepted',
  TARGET_SUGGESTION_DISMISSED: 'target_suggestion_dismissed',
  // install / notification / rating prompts
  A2HS_ACCEPTED: 'a2hs_accepted',
  A2HS_DECLINED: 'a2hs_declined',
  A2HS_DISMISSED: 'a2hs_dismissed',
  REMINDERS_ENABLED: 'reminders_enabled',
  REMINDERS_PRIME_DISMISSED: 'reminders_prime_dismissed',
  RATE_PROMPT_CLICKED: 'rate_prompt_clicked',
  RATE_PROMPT_DISMISSED: 'rate_prompt_dismissed',
  /** The week-3-4 stall message. `kind` distinguishes the three explanations. */
  PLATEAU_CARD_DISMISSED: 'plateau_card_dismissed',
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
  // AI is Pro-only as of 2026-07-18. The former `camera_scan_limit` /
  // `chat_scan_limit` sources meant "hit your free daily cap", which no longer
  // exists — these are deliberately new names so the funnel doesn't silently
  // blend two different events with different meanings.
  | 'camera_scan_pro'
  | 'chat_scan_pro'
  | 'custom_foods'
  | 'history_limit'
  | 'recap_end_card'
  // The monthly Wrapped's locked card. Unlike every other source here it
  // doesn't block an action — it withholds something about the user that they
  // can already see exists, which is a different (and better-converting) ask.
  | 'wrapped'
  // Dormant: the suggestion deck (with its own end-of-deck wall) was cut to a
  // single inline row on 2026-08-23, which renders no upgrade affordance. Kept
  // named for when a wall returns to that surface.
  | 'meal_suggestions'
  // Reserved: there is no anonymous AI entry point today (every AI route
  // requires an authenticated user). Kept named so the funnel has a slot ready
  // if an anonymous scan-to-signup surface is ever added.
  | 'camera_scan_anonymous'
  | 'chat_scan_anonymous'

/**
 * The `surface` prop on every `story_*` event — which sequence was playing.
 * One engine renders all of them, so without this they'd be indistinguishable
 * in the funnel.
 */
export const STORY_SURFACES = ['welcome', 'monthly_wrapped', 'onboarding_plan'] as const

export type StorySurface = (typeof STORY_SURFACES)[number]

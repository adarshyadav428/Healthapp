import type { Profile } from '../types/index'

/**
 * The user-facing goal selector.
 *
 * Four values, because "lose fat and build muscle at the same time" is the
 * outcome most new users actually want and the three-value `goal` column has
 * no word for it — such a user had to pick "Lose" and was given no signal that
 * the app understood them.
 *
 * `goal` itself stays three-valued on purpose: around twenty modules branch on
 * it (deficit-calculator, plateau, adaptiveTarget, planCards, goalProjection,
 * WeightStats, the paywall), and a fourth enum value means re-auditing every
 * one. So this is what the user picks, and `planForFocus` derives the `goal`
 * the maths actually runs on.
 */
export const BODY_FOCUSES = ['fat_loss', 'recomp', 'maintain', 'muscle_gain'] as const
export type BodyFocus = (typeof BODY_FOCUSES)[number]

/**
 * Self-reported build. Its only job is to preselect a focus.
 *
 * It is a preference, never a measurement: nothing here estimates body fat,
 * and no surface may present a silhouette tap as if it were a reading.
 */
export const BODY_TYPES = ['skinny', 'skinny_fat', 'average', 'soft', 'athletic'] as const
export type BodyType = (typeof BODY_TYPES)[number]

/**
 * The weekly pace both muscle-building focuses are pinned to.
 *
 * 1 kg/week and "build muscle" are a contradiction — a gentle deficit is the
 * only deficit in which muscle is realistically kept, and the same gentle
 * surplus is what keeps a bulk from being mostly fat.
 */
export const RECOMP_PACE_KG_PER_WEEK = 0.25

export const BODY_FOCUS_META: Record<BodyFocus, { label: string; emoji: string; desc: string }> = {
  fat_loss:    { label: 'Lose fat',                emoji: '📉', desc: 'Get the weight down' },
  recomp:      { label: 'Build muscle & lose fat', emoji: '🔁', desc: 'Scale moves slowly, shape changes' },
  maintain:    { label: 'Maintain',                emoji: '⚖️', desc: 'Hold where you are' },
  muscle_gain: { label: 'Build muscle',            emoji: '📈', desc: 'Add size steadily' },
}

export const BODY_TYPE_META: Record<BodyType, { label: string }> = {
  skinny:     { label: 'Skinny' },
  skinny_fat: { label: 'Skinny fat' },
  average:    { label: 'Average' },
  soft:       { label: 'Softer' },
  athletic:   { label: 'Athletic' },
}

/**
 * The one mapping from what the user picked to what the maths runs on.
 *
 * `pace: null` means "leave whatever pace the user chose alone". Only the two
 * muscle focuses pin a pace, for the reason on RECOMP_PACE_KG_PER_WEEK above.
 */
export function planForFocus(focus: BodyFocus): { goal: Profile['goal']; pace: number | null } {
  switch (focus) {
    case 'recomp':
      return { goal: 'lose', pace: RECOMP_PACE_KG_PER_WEEK }
    case 'maintain':
      return { goal: 'maintain', pace: null }
    case 'muscle_gain':
      return { goal: 'gain', pace: RECOMP_PACE_KG_PER_WEEK }
    case 'fat_loss':
    default:
      return { goal: 'lose', pace: null }
  }
}

/** Which focus a self-reported build starts the user on. Always overridable. */
export function focusFromBodyType(type: BodyType): BodyFocus {
  switch (type) {
    case 'skinny':
      return 'muscle_gain'
    case 'soft':
      return 'fat_loss'
    case 'skinny_fat':
    case 'average':
    case 'athletic':
    default:
      return 'recomp'
  }
}

/**
 * Which focus tile to light up for an existing profile.
 *
 * Every account that onboarded before migration 040 has `body_focus IS NULL`,
 * so without this fallback Settings would render nothing selected for the
 * entire existing userbase.
 */
export function focusFromProfile(profile: {
  body_focus?: BodyFocus | null
  goal: Profile['goal']
}): BodyFocus {
  if (profile.body_focus && (BODY_FOCUSES as readonly string[]).includes(profile.body_focus)) {
    return profile.body_focus
  }
  switch (profile.goal) {
    case 'maintain':
      return 'maintain'
    case 'gain':
      return 'muscle_gain'
    default:
      return 'fat_loss'
  }
}

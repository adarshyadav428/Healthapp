import type { Profile } from '../types/index'

/**
 * Grams of protein per kg of bodyweight behind every protein target.
 * Exported so the UI can state the assumption instead of showing a bare
 * number the user has no way to sanity-check.
 */
export const PROTEIN_G_PER_KG = 1.6

/** 1 kg of body fat ≈ 7,700 kcal — the basis of every pace/projection claim. */
export const KCAL_PER_KG_FAT = 7700

type MacroTargets = {
  daily_calorie_target: number
  protein_g_target: number
  carbs_g_target: number
  fat_g_target: number
  /** What the body burns in a day, before any deficit. See `calculateMaintenance`. */
  maintenance_kcal: number
}

/**
 * Maintenance calories, broken into the parts it was built from.
 *
 * Returned as parts rather than one number so the UI can *show its working* —
 * "BMR 1,649 + activity (moderate ×1.55) = 2,556" answers "where did this come
 * from?", which a bare 2,556 never does.
 */
export type Maintenance = {
  /** Basal metabolic rate, rounded for display. */
  bmr: number
  /** The activity multiplier applied to BMR (1.2–1.9). */
  multiplier: number
  /** kcal attributable to activity — the difference maintenance adds over BMR. */
  activityKcal: number
  /** Maintenance / TDEE: what the body burns in a day, all in. */
  tdee: number
}

export function calculateBMR({ weightKg, heightCm, age, sex }: { weightKg: number; heightCm: number; age: number; sex: 'male' | 'female' | 'other' }): number {
  if (sex === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  }
  if (sex === 'female') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161
  }
  // 'other': use the average of male (+5) and female (-161) constants = -78
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 78
}

export function activityMultiplier(level: Profile['activity_level']): number {
  switch (level) {
    case 'sedentary':
      return 1.2
    case 'light':
      return 1.375
    case 'moderate':
      return 1.55
    case 'active':
      return 1.725
    case 'very_active':
      return 1.9
    default:
      return 1.2
  }
}

/**
 * The single source of maintenance calories. Every screen that shows a deficit
 * derives it from here — four separate hand-rolled copies of this arithmetic
 * are what let `/progress` and `/deficit` disagree about the same word.
 *
 * `tdee` is rounded from the *unrounded* BMR, so the number matches what
 * `calculateTDEE` has always produced; `bmr` is rounded only for display.
 */
export function calculateMaintenance(profile: {
  weightKg: number
  heightCm: number
  age: number
  sex: Profile['sex']
  activity_level: Profile['activity_level']
}): Maintenance {
  const { weightKg, heightCm, age, sex, activity_level } = profile
  const rawBmr = calculateBMR({ weightKg, heightCm, age, sex })
  const multiplier = activityMultiplier(activity_level)
  const tdee = Math.round(rawBmr * multiplier)
  const bmr = Math.round(rawBmr)
  return { bmr, multiplier, activityKcal: tdee - bmr, tdee }
}

export function calculateTDEE(profile: { weightKg: number; heightCm: number; age: number; sex: Profile['sex']; activity_level: Profile['activity_level']; goal: Profile['goal']; paceKgPerWeek?: number }): MacroTargets {
  const { weightKg, heightCm, age, sex, activity_level, goal, paceKgPerWeek = 0.5 } = profile
  const { tdee } = calculateMaintenance({ weightKg, heightCm, age, sex, activity_level })

  // 1 kg fat = 7,700 kcal → daily deficit = pace × 7700 ÷ 7
  let delta = 0
  if (goal === 'lose') delta = -Math.round(paceKgPerWeek * 7700 / 7)
  else if (goal === 'gain') delta = Math.round(paceKgPerWeek * 7700 / 7)

  const daily_calorie_target = Math.max(1200, Math.round(tdee + delta))

  // Protein: PROTEIN_G_PER_KG g/kg bodyweight. Enough for satiety and muscle retention in a
  // deficit, but not the 2 g/kg bodybuilder split that left carbs so low it was
  // near-impossible on a roti/rice/dal diet (users failing macros daily).
  const protein_g_target = Math.round(PROTEIN_G_PER_KG * weightKg)
  // Fat: 0.8g/kg
  const fat_g_target = Math.round(0.8 * weightKg)
  // Remaining calories to carbs
  const caloriesFromProtein = protein_g_target * 4
  const caloriesFromFat = fat_g_target * 9
  const caloriesForCarbs = Math.max(0, daily_calorie_target - caloriesFromProtein - caloriesFromFat)
  const carbs_g_target = Math.round(caloriesForCarbs / 4)

  return { daily_calorie_target, protein_g_target, carbs_g_target, fat_g_target, maintenance_kcal: tdee }
}

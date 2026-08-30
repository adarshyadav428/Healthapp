import { z } from 'zod'
import { MEAL_CONTEXTS } from './mealContext'
import { MAX_LOG_GRAMS } from './portion-units'
import { BODY_FOCUSES, BODY_TYPES } from './bodyType'

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// Sign-up asks only for email + password (no confirm field — a show/hide
// toggle on the password input is friendlier and cuts a step off onboarding).
export const signUpSchema = signInSchema

export const onboardingSchema = z.object({
  display_name: z.string().min(1),
  age: z.number().int().min(13).max(120),
  sex: z.enum(['male', 'female', 'other']),
  height_cm: z.number().positive(),
  current_weight_kg: z.number().positive(),
  target_weight_kg: z.number().positive(),
  // Stays three-valued. The four-value selector the user actually sees is
  // `body_focus` below; the routes derive this from it via `planForFocus`.
  goal: z.enum(['lose', 'maintain', 'gain']),
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  pace_kg_per_week: z.number().min(0).max(2),
  // Optional so a client that predates migration 040 — or a resumed
  // localStorage draft saved before it — still submits successfully.
  body_focus: z.enum(BODY_FOCUSES).optional(),
  body_type: z.enum(BODY_TYPES).optional(),
})

export const addFoodSchema = z.object({
  food_id: z.string().uuid(),
  meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  servings: z.number().positive().max(99, { message: 'Servings cannot exceed 99' }),
  grams: z.number().positive().max(MAX_LOG_GRAMS, { message: 'Grams cannot exceed 10,000' }),
  // Optional backfill target — an IST calendar date (YYYY-MM-DD). Absent = today.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Where the meal was eaten. Optional and nullable — a wrong value is worse
  // than none, because the insight in lib/mealContext.ts compares days that
  // have a context against days that don't. Only the edit route accepted this
  // until 2026-07-31, which meant every log was born NULL and the insight had
  // nothing to work with.
  context: z.enum(MEAL_CONTEXTS).nullable().optional(),
  // Set only by the undo action on a just-deleted entry. It re-inserts a row
  // the user already logged once, so it must not count as a new log: no
  // `food_logged` event and no milestone, or an undo would inflate the log
  // count and could fire the first-log celebration a second time.
  restore: z.boolean().optional(),
})

/**
 * Editing an existing log entry. Lives here rather than inline in
 * app/api/logs/edit/route.ts so it is testable and so its bounds can be read
 * against addFoodSchema's — the two used to disagree, and an edit could store
 * a grams amount the add path forbids.
 *
 * The macro fields are client-computed here (unlike the add route, which
 * recomputes them server-side from the food row) because an entry may have no
 * linked food at all — a camera or chat log carries its own macros.
 */
export const editFoodLogSchema = z.object({
  id: z.string().uuid(),
  grams: z.number().positive().max(MAX_LOG_GRAMS, { message: 'Grams cannot exceed 10,000' }),
  servings: z.number().positive().max(99, { message: 'Servings cannot exceed 99' }).default(1),
  meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  // Optional by design (migration 032). `null` is a real value here — it's how
  // a user clears a tag they set by mistake — so nullable rather than optional
  // alone, and `undefined` leaves the existing tag untouched.
  context: z.enum(MEAL_CONTEXTS).nullable().optional(),
})

export const weightLogSchema = z.object({
  weight_kg: z.number().positive(),
  // Use Date constructor — more strict than Date.parse which accepts partial strings
  measured_at: z.string().refine(
    (s) => {
      const d = new Date(s)
      return !Number.isNaN(d.getTime()) && s.trim().length > 0
    },
    { message: 'Invalid date' }
  ),
  notes: z.string().optional(),
})

export const exerciseLogSchema = z.object({
  activity: z.string().min(2, { message: 'Activity is required' }),
  duration_min: z.number().positive().max(600, { message: 'Duration cannot exceed 600 minutes' }),
  calories: z.number().positive().max(5000, { message: 'Calories cannot exceed 5,000' }),
})

export const profileUpdateSchema = z.object({
  display_name: z.string().min(1),
  height_cm: z.number().positive(),
  current_weight_kg: z.number().positive(),
  target_weight_kg: z.number().positive(),
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  goal: z.enum(['lose', 'maintain', 'gain']),
  body_focus: z.enum(BODY_FOCUSES).optional(),
  body_type: z.enum(BODY_TYPES).optional(),
  pace_kg_per_week: z.number().min(0.25).max(1.0).optional(),
  water_target_ml: z.number().min(500).max(8000).optional(),
  // Manual target overrides — when present, skip TDEE recalculation
  custom_calorie_target: z.number().int().min(500).max(10000).optional(),
  custom_protein_target: z.number().int().min(0).max(500).optional(),
  custom_carbs_target: z.number().int().min(0).max(1000).optional(),
  custom_fat_target: z.number().int().min(0).max(500).optional(),
})

export const customFoodSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  brand: z.string().max(60).optional(),
  serving_size_g: z.number().positive().max(2000),
  serving_description: z.string().max(50).default('1 serving'),
  kcal_per_100g: z.number().min(0).max(9000),
  protein_g_per_100g: z.number().min(0).max(100),
  carbs_g_per_100g: z.number().min(0).max(100),
  fat_g_per_100g: z.number().min(0).max(100),
  fiber_g_per_100g: z.number().min(0).max(100).optional(),
}).superRefine((d, ctx) => {
  // Macros physically cannot exceed 100g per 100g of food
  const totalMacros = d.protein_g_per_100g + d.carbs_g_per_100g + d.fat_g_per_100g
  if (totalMacros > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Protein + Carbs + Fat = ${totalMacros.toFixed(1)}g which exceeds 100g per 100g. Check your values.`,
      path: ['protein_g_per_100g'],
    })
  }
  // Calories should roughly match macros (within 25% tolerance)
  if (d.kcal_per_100g > 0) {
    const estimatedKcal = d.protein_g_per_100g * 4 + d.carbs_g_per_100g * 4 + d.fat_g_per_100g * 9
    const ratio = d.kcal_per_100g / estimatedKcal
    if (estimatedKcal > 0 && (ratio < 0.75 || ratio > 1.25)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Calories (${d.kcal_per_100g}) don't match macros (~${Math.round(estimatedKcal)} kcal expected). Double-check your values.`,
        path: ['kcal_per_100g'],
      })
    }
  }
})

export type CustomFoodData = z.infer<typeof customFoodSchema>

export type SignInData = z.infer<typeof signInSchema>
export type SignUpData = z.infer<typeof signUpSchema>
export type OnboardingData = z.infer<typeof onboardingSchema>
export type AddFoodData = z.infer<typeof addFoodSchema>
export type WeightLogData = z.infer<typeof weightLogSchema>
export type ExerciseLogData = z.infer<typeof exerciseLogSchema>
export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>

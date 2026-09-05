import { z } from 'zod'
import { MEAL_CONTEXTS } from './mealContext'
import { MAX_LOG_GRAMS } from './portion-units'
import { BODY_FOCUSES, BODY_TYPES } from './bodyType'

/**
 * Human bounds for the body measurements every calorie target is computed from.
 *
 * These were `z.number().positive()` — unbounded above, and `positive()` lets
 * `Infinity` through. The server does not merely store these: it feeds them to
 * `calculateTDEE` and writes the result back, so the nonsense was
 * server-generated. Observed before this bound existed: 5,000 kg →
 * `daily_calorie_target` **78,421** and a protein target of 8,000 g; 1e9 kg →
 * a target of 15,500,000,921; `height_cm: Infinity` → every macro target
 * `Infinity`. `age` (13–120) and `pace_kg_per_week` (0–2) were already bounded
 * and `customFoodSchema` bounds everything, so this was an oversight rather
 * than a policy — audit 2026-09-03, P2-14.
 *
 * The ranges are deliberately generous: wider than any real user, narrow
 * enough that the arithmetic downstream stays finite. One constant each, so
 * onboarding, the profile update and a weigh-in cannot disagree about what a
 * plausible body is — they are three doors to the same column.
 */
export const HEIGHT_CM = { min: 50, max: 275 } as const
export const WEIGHT_KG = { min: 20, max: 500 } as const

const heightCm = z
  .number()
  .min(HEIGHT_CM.min, { message: `Height must be at least ${HEIGHT_CM.min} cm` })
  .max(HEIGHT_CM.max, { message: `Height cannot exceed ${HEIGHT_CM.max} cm` })

const weightKg = z
  .number()
  .min(WEIGHT_KG.min, { message: `Weight must be at least ${WEIGHT_KG.min} kg` })
  .max(WEIGHT_KG.max, { message: `Weight cannot exceed ${WEIGHT_KG.max} kg` })

/**
 * A name, not a document. Unbounded before, which accepted 10,000 characters
 * of HTML and RTL marks — React escapes the markup, so this was never XSS, but
 * it is rendered in a fixed-width header and a share card that have no answer
 * for it. Same finding's evidence column.
 */
const displayName = z.string().trim().min(1).max(80, { message: 'Name cannot exceed 80 characters' })

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// Sign-up asks only for email + password (no confirm field — a show/hide
// toggle on the password input is friendlier and cuts a step off onboarding).
export const signUpSchema = signInSchema

export const onboardingSchema = z.object({
  display_name: displayName,
  age: z.number().int().min(13).max(120),
  sex: z.enum(['male', 'female', 'other']),
  height_cm: heightCm,
  current_weight_kg: weightKg,
  target_weight_kg: weightKg,
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
  // Bounds match quick-add's (app/api/logs/quick-add/route.ts) — the same
  // client-computed-macro shape, so the same ceilings apply. These were
  // nonnegative() with no upper bound: the one macro-accepting path that
  // neither recomputes server-side (add-bulk, meals/log) nor caps the client
  // value (quick-add) — self-scoped to the caller's own row, but still able
  // to corrupt their own deficit, streak, Trends, weekly-recap and Wrapped
  // stats, the last of which feeds a number into a Gemini prompt. Audit
  // 2026-09-04, P2-2.
  kcal: z.number().nonnegative().max(5000, { message: 'Calories cannot exceed 5,000' }),
  protein_g: z.number().nonnegative().max(500, { message: 'Protein cannot exceed 500g' }),
  carbs_g: z.number().nonnegative().max(1000, { message: 'Carbs cannot exceed 1,000g' }),
  fat_g: z.number().nonnegative().max(500, { message: 'Fat cannot exceed 500g' }),
  // Optional by design (migration 032). `null` is a real value here — it's how
  // a user clears a tag they set by mistake — so nullable rather than optional
  // alone, and `undefined` leaves the existing tag untouched.
  context: z.enum(MEAL_CONTEXTS).nullable().optional(),
})

export const weightLogSchema = z.object({
  weight_kg: weightKg,
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
  display_name: displayName,
  height_cm: heightCm,
  current_weight_kg: weightKg,
  target_weight_kg: weightKg,
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  goal: z.enum(['lose', 'maintain', 'gain']),
  body_focus: z.enum(BODY_FOCUSES).optional(),
  body_type: z.enum(BODY_TYPES).optional(),
  pace_kg_per_week: z.number().min(0.25).max(1.0).optional(),
  // `water_target_ml` was accepted here until 2026-09-04. Nothing has rendered
  // a water target since `019_drop_deprecated_tables.sql` removed `water_logs`,
  // but the field kept making a full round trip — selected on /log's hot path,
  // echoed back by two components, validated here, and with its own named
  // branch in the update route's error recovery. Dead *and* load-bearing, which
  // meant dropping the column would have 500'd profile updates (P2-3). The
  // column itself is left in place; nothing writes it now.
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

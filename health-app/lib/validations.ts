import { z } from 'zod'

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const signUpSchema = signInSchema.extend({
  confirmPassword: z.string().min(8),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Passwords must match', path: ['confirmPassword'] })
})

export const onboardingSchema = z.object({
  display_name: z.string().min(1),
  age: z.number().int().min(13).max(120),
  sex: z.enum(['male', 'female', 'other']),
  height_cm: z.number().positive(),
  current_weight_kg: z.number().positive(),
  target_weight_kg: z.number().positive(),
  goal: z.enum(['lose', 'maintain', 'gain']),
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  pace_kg_per_week: z.number().min(0).max(2),
})

export const addFoodSchema = z.object({
  food_id: z.string().uuid(),
  meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  servings: z.number().positive().max(99, { message: 'Servings cannot exceed 99' }),
  grams: z.number().positive().max(10000, { message: 'Grams cannot exceed 10,000' }),
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

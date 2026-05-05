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
  unit_system: z.enum(['metric', 'imperial']),
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
})

export type SignInData = z.infer<typeof signInSchema>
export type SignUpData = z.infer<typeof signUpSchema>
export type OnboardingData = z.infer<typeof onboardingSchema>
export type AddFoodData = z.infer<typeof addFoodSchema>
export type WeightLogData = z.infer<typeof weightLogSchema>
export type ExerciseLogData = z.infer<typeof exerciseLogSchema>
export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>

import { describe, it, expect } from 'vitest'
import {
  signUpSchema,
  onboardingSchema,
  addFoodSchema,
  editFoodLogSchema,
  weightLogSchema,
  exerciseLogSchema,
  profileUpdateSchema,
  customFoodSchema,
} from '../lib/validations'
import { MAX_LOG_GRAMS } from '../lib/portion-units'

describe('signUpSchema', () => {
  it('accepts a valid email + password', () => {
    const r = signUpSchema.safeParse({ email: 'a@b.com', password: 'password1' })
    expect(r.success).toBe(true)
  })

  it('rejects passwords under 8 chars', () => {
    const r = signUpSchema.safeParse({ email: 'a@b.com', password: 'short' })
    expect(r.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const r = signUpSchema.safeParse({ email: 'not-an-email', password: 'password1' })
    expect(r.success).toBe(false)
  })
})

describe('onboardingSchema', () => {
  const valid = {
    display_name: 'Adarsh',
    age: 25,
    sex: 'male',
    height_cm: 175,
    current_weight_kg: 80,
    target_weight_kg: 70,
    goal: 'lose',
    activity_level: 'moderate',
    pace_kg_per_week: 0.5,
  }

  it('accepts a valid payload', () => {
    expect(onboardingSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects under-13 users (age floor)', () => {
    expect(onboardingSchema.safeParse({ ...valid, age: 12 }).success).toBe(false)
  })

  it('rejects a pace above 2 kg/week', () => {
    expect(onboardingSchema.safeParse({ ...valid, pace_kg_per_week: 2.5 }).success).toBe(false)
  })

  it('rejects non-positive weight and height', () => {
    expect(onboardingSchema.safeParse({ ...valid, current_weight_kg: 0 }).success).toBe(false)
    expect(onboardingSchema.safeParse({ ...valid, height_cm: -170 }).success).toBe(false)
  })

  it('rejects string numbers (no silent coercion at the API boundary)', () => {
    expect(onboardingSchema.safeParse({ ...valid, age: '25' }).success).toBe(false)
  })
})

describe('addFoodSchema', () => {
  const valid = { food_id: 'e58ed763-928c-4155-bee9-fdbaaadc15f3', meal: 'lunch', servings: 1, grams: 150 }

  it('accepts a valid payload', () => {
    expect(addFoodSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects non-uuid food_id', () => {
    expect(addFoodSchema.safeParse({ ...valid, food_id: '123' }).success).toBe(false)
  })

  it('caps servings at 99 and grams at MAX_LOG_GRAMS', () => {
    expect(addFoodSchema.safeParse({ ...valid, servings: 100 }).success).toBe(false)
    expect(MAX_LOG_GRAMS).toBe(10000)
    expect(addFoodSchema.safeParse({ ...valid, grams: MAX_LOG_GRAMS }).success).toBe(true)
    expect(addFoodSchema.safeParse({ ...valid, grams: MAX_LOG_GRAMS + 1 }).success).toBe(false)
  })

  it('rejects a non-positive or unparseable grams amount', () => {
    // The stepper clamps client-side; this is the boundary that has to hold
    // regardless of what any caller sends.
    expect(addFoodSchema.safeParse({ ...valid, grams: 0 }).success).toBe(false)
    expect(addFoodSchema.safeParse({ ...valid, grams: -5 }).success).toBe(false)
    expect(addFoodSchema.safeParse({ ...valid, grams: NaN }).success).toBe(false)
    expect(addFoodSchema.safeParse({ ...valid, servings: 0 }).success).toBe(false)
  })

  it('rejects unknown meal names', () => {
    expect(addFoodSchema.safeParse({ ...valid, meal: 'brunch' }).success).toBe(false)
  })
})

describe('editFoodLogSchema', () => {
  const valid = {
    id: 'e58ed763-928c-4155-bee9-fdbaaadc15f3',
    grams: 150,
    servings: 1,
    meal: 'lunch',
    kcal: 200,
    protein_g: 5,
    carbs_g: 30,
    fat_g: 4,
  }

  it('accepts a valid payload', () => {
    expect(editFoodLogSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a non-positive grams amount', () => {
    expect(editFoodLogSchema.safeParse({ ...valid, grams: 0 }).success).toBe(false)
    expect(editFoodLogSchema.safeParse({ ...valid, grams: -5 }).success).toBe(false)
    expect(editFoodLogSchema.safeParse({ ...valid, grams: NaN }).success).toBe(false)
  })

  it('enforces the same bounds as the add path', () => {
    // These used to disagree: an edit could store grams the add route forbade.
    expect(editFoodLogSchema.safeParse({ ...valid, grams: MAX_LOG_GRAMS }).success).toBe(true)
    expect(editFoodLogSchema.safeParse({ ...valid, grams: MAX_LOG_GRAMS + 1 }).success).toBe(false)
    expect(editFoodLogSchema.safeParse({ ...valid, servings: 100 }).success).toBe(false)
  })

  it('defaults servings and keeps context nullable but optional', () => {
    const { servings, ...noServings } = valid
    const parsed = editFoodLogSchema.safeParse(noServings)
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.servings).toBe(1)
    expect(editFoodLogSchema.safeParse({ ...valid, context: null }).success).toBe(true)
    expect(editFoodLogSchema.safeParse({ ...valid, context: 'restaurant' }).success).toBe(true)
    expect(editFoodLogSchema.safeParse({ ...valid, context: 'spaceship' }).success).toBe(false)
  })

  it('rejects negative macros', () => {
    expect(editFoodLogSchema.safeParse({ ...valid, kcal: -1 }).success).toBe(false)
    expect(editFoodLogSchema.safeParse({ ...valid, protein_g: -1 }).success).toBe(false)
  })
})

describe('weightLogSchema', () => {
  it('accepts an ISO timestamp', () => {
    const r = weightLogSchema.safeParse({ weight_kg: 72.5, measured_at: '2026-07-16T10:00:00Z' })
    expect(r.success).toBe(true)
  })

  it('rejects invalid dates and empty strings', () => {
    expect(weightLogSchema.safeParse({ weight_kg: 72, measured_at: 'not-a-date' }).success).toBe(false)
    expect(weightLogSchema.safeParse({ weight_kg: 72, measured_at: '  ' }).success).toBe(false)
  })

  it('rejects non-positive weight', () => {
    expect(weightLogSchema.safeParse({ weight_kg: 0, measured_at: '2026-07-16' }).success).toBe(false)
  })
})

describe('exerciseLogSchema', () => {
  it('caps duration at 600 min and calories at 5000', () => {
    expect(exerciseLogSchema.safeParse({ activity: 'Running', duration_min: 601, calories: 300 }).success).toBe(false)
    expect(exerciseLogSchema.safeParse({ activity: 'Running', duration_min: 30, calories: 5001 }).success).toBe(false)
    expect(exerciseLogSchema.safeParse({ activity: 'Running', duration_min: 30, calories: 300 }).success).toBe(true)
  })
})

describe('profileUpdateSchema', () => {
  const valid = {
    display_name: 'Adarsh',
    height_cm: 175,
    current_weight_kg: 78,
    target_weight_kg: 70,
    activity_level: 'moderate',
    goal: 'lose',
  }

  it('accepts a payload without optional custom targets', () => {
    expect(profileUpdateSchema.safeParse(valid).success).toBe(true)
  })

  it('bounds custom calorie target to 500–10,000', () => {
    expect(profileUpdateSchema.safeParse({ ...valid, custom_calorie_target: 499 }).success).toBe(false)
    expect(profileUpdateSchema.safeParse({ ...valid, custom_calorie_target: 10001 }).success).toBe(false)
    expect(profileUpdateSchema.safeParse({ ...valid, custom_calorie_target: 1800 }).success).toBe(true)
  })

  it('bounds pace to 0.25–1.0 and water target to 500–8000', () => {
    expect(profileUpdateSchema.safeParse({ ...valid, pace_kg_per_week: 0.1 }).success).toBe(false)
    expect(profileUpdateSchema.safeParse({ ...valid, pace_kg_per_week: 1.5 }).success).toBe(false)
    expect(profileUpdateSchema.safeParse({ ...valid, water_target_ml: 400 }).success).toBe(false)
  })
})

describe('customFoodSchema', () => {
  const valid = {
    name: 'Homemade Poha',
    serving_size_g: 200,
    kcal_per_100g: 130,
    protein_g_per_100g: 3,
    carbs_g_per_100g: 25,
    fat_g_per_100g: 2,
  }

  it('accepts a plausible food', () => {
    expect(customFoodSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects macros summing over 100g per 100g', () => {
    const r = customFoodSchema.safeParse({ ...valid, protein_g_per_100g: 50, carbs_g_per_100g: 40, fat_g_per_100g: 20 })
    expect(r.success).toBe(false)
  })

  it('rejects calories inconsistent with macros (>25% off)', () => {
    // macros ≈ 130 kcal but claimed 400
    const r = customFoodSchema.safeParse({ ...valid, kcal_per_100g: 400 })
    expect(r.success).toBe(false)
  })

  it('defaults serving_description to "1 serving"', () => {
    const r = customFoodSchema.safeParse(valid)
    expect(r.success && r.data.serving_description).toBe('1 serving')
  })
})

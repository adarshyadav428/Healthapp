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

  it('accepts every body_focus and body_type', () => {
    for (const body_focus of ['fat_loss', 'recomp', 'maintain', 'muscle_gain']) {
      expect(onboardingSchema.safeParse({ ...valid, body_focus }).success).toBe(true)
    }
    for (const body_type of ['skinny', 'skinny_fat', 'average', 'soft', 'athletic']) {
      expect(onboardingSchema.safeParse({ ...valid, body_type }).success).toBe(true)
    }
  })

  it('leaves both optional, so a pre-040 client still submits', () => {
    expect(onboardingSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects junk in either new field', () => {
    expect(onboardingSchema.safeParse({ ...valid, body_focus: 'bulk' }).success).toBe(false)
    expect(onboardingSchema.safeParse({ ...valid, body_type: 'dad_bod' }).success).toBe(false)
  })

  it('the goal enum did not grow — "recomp" is a focus, never a goal', () => {
    expect(onboardingSchema.safeParse({ ...valid, goal: 'recomp' }).success).toBe(false)
    expect(profileUpdateSchema.safeParse({ ...valid, goal: 'recomp' }).success).toBe(false)
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

  // `restore` marks an undo of a just-deleted entry. The routes branch on it
  // being exactly `true` to skip the food_logged event and the milestone, so
  // an ordinary log must never arrive carrying it by accident.
  it('leaves restore undefined unless the client sends it', () => {
    const parsed = addFoodSchema.safeParse(valid)
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.restore).toBeUndefined()
  })

  it('accepts restore as a boolean and rejects anything else', () => {
    expect(addFoodSchema.safeParse({ ...valid, restore: true }).success).toBe(true)
    expect(addFoodSchema.safeParse({ ...valid, restore: 'yes' }).success).toBe(false)
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

  /**
   * kcal/protein_g/carbs_g/fat_g were `nonnegative()` with no ceiling — the one
   * macro-accepting path that neither recomputes server-side (add-bulk,
   * meals/log) nor caps the client value (quick-add). Self-scoped to the
   * caller's own row, but a corrupted value here still feeds their own
   * deficit, streak, Trends, weekly-recap and Wrapped stats — the last of
   * which is fed into a Gemini prompt. Bounds match quick-add's
   * (app/api/logs/quick-add/route.ts), the closest existing precedent for a
   * client-computed macro shape. Audit 2026-09-04, P2-2.
   */
  it('bounds kcal/protein_g/carbs_g/fat_g the same way quick-add does', () => {
    expect(editFoodLogSchema.safeParse({ ...valid, kcal: 5000 }).success).toBe(true)
    expect(editFoodLogSchema.safeParse({ ...valid, kcal: 5001 }).success).toBe(false)
    expect(editFoodLogSchema.safeParse({ ...valid, kcal: 999999999 }).success).toBe(false)
    expect(editFoodLogSchema.safeParse({ ...valid, protein_g: 500 }).success).toBe(true)
    expect(editFoodLogSchema.safeParse({ ...valid, protein_g: 501 }).success).toBe(false)
    expect(editFoodLogSchema.safeParse({ ...valid, carbs_g: 1000 }).success).toBe(true)
    expect(editFoodLogSchema.safeParse({ ...valid, carbs_g: 1001 }).success).toBe(false)
    expect(editFoodLogSchema.safeParse({ ...valid, fat_g: 500 }).success).toBe(true)
    expect(editFoodLogSchema.safeParse({ ...valid, fat_g: 501 }).success).toBe(false)
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

  // `water_target_ml` was bounded here too until 2026-09-04. The field is gone
  // rather than re-bounded — see "no longer accepts water_target_ml" below.
  it('bounds pace to 0.25–1.0', () => {
    expect(profileUpdateSchema.safeParse({ ...valid, pace_kg_per_week: 0.1 }).success).toBe(false)
    expect(profileUpdateSchema.safeParse({ ...valid, pace_kg_per_week: 1.5 }).success).toBe(false)
    expect(profileUpdateSchema.safeParse({ ...valid, pace_kg_per_week: 0.5 }).success).toBe(true)
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

/**
 * Body measurements are bounded, above and below.
 *
 * These were `z.number().positive()`: unbounded, and `positive()` lets
 * `Infinity` through. The route does not merely store them — it feeds them to
 * `calculateTDEE` and writes the result back — so a hostile or fat-fingered
 * value produced *server-generated* nonsense. Observed before the bound:
 * 5,000 kg → daily_calorie_target 78,421 and 8,000 g of protein; 1e9 kg →
 * 15,500,000,921; height Infinity → every macro target Infinity.
 *
 * `age` and `pace_kg_per_week` were already bounded and `customFoodSchema`
 * bounds everything, so this was an oversight, not a policy (2026-09-03, P2-14).
 */
describe('height and weight bounds', () => {
  const onboarding = {
    display_name: 'Test',
    age: 30,
    sex: 'male' as const,
    height_cm: 175,
    current_weight_kg: 80,
    target_weight_kg: 70,
    goal: 'lose' as const,
    activity_level: 'moderate' as const,
    pace_kg_per_week: 0.5,
  }

  it('accepts a real person', () => {
    expect(onboardingSchema.safeParse(onboarding).success).toBe(true)
  })

  it.each([
    ['height_cm', Infinity],
    ['height_cm', 1e9],
    ['height_cm', 400],
    ['height_cm', 3],
    ['current_weight_kg', Infinity],
    ['current_weight_kg', 5000],
    ['current_weight_kg', 1e9],
    ['current_weight_kg', 0.5],
    ['target_weight_kg', Infinity],
    ['target_weight_kg', 5000],
  ])('onboarding rejects %s = %s', (field, value) => {
    const result = onboardingSchema.safeParse({ ...onboarding, [field]: value })
    expect(result.success, `${field}=${value} must not reach calculateTDEE`).toBe(false)
  })

  it.each([
    ['height_cm', Infinity],
    ['height_cm', 5000],
    ['current_weight_kg', Infinity],
    ['current_weight_kg', 5000],
    ['target_weight_kg', 1e9],
  ])('the profile update rejects %s = %s too', (field, value) => {
    // Both doors write the same column and both recompute targets, so a bound
    // on one and not the other is the same hole with an extra step.
    const base = {
      display_name: 'Test',
      height_cm: 175,
      current_weight_kg: 80,
      target_weight_kg: 70,
      activity_level: 'moderate' as const,
      goal: 'lose' as const,
    }
    expect(profileUpdateSchema.safeParse({ ...base, [field]: value }).success).toBe(false)
  })

  it('a weigh-in is bounded by the same constants', () => {
    const at = (weight_kg: number) =>
      weightLogSchema.safeParse({ weight_kg, measured_at: '2026-09-04T00:00:00Z' }).success
    expect(at(80)).toBe(true)
    expect(at(Infinity)).toBe(false)
    expect(at(5000)).toBe(false)
  })

  it('a display name is a name, not a document', () => {
    const base = {
      display_name: 'x'.repeat(10_000),
      height_cm: 175,
      current_weight_kg: 80,
      target_weight_kg: 70,
      activity_level: 'moderate' as const,
      goal: 'lose' as const,
    }
    expect(profileUpdateSchema.safeParse(base).success).toBe(false)
    expect(profileUpdateSchema.safeParse({ ...base, display_name: 'Adarsh' }).success).toBe(true)
  })

  it('no longer accepts water_target_ml', () => {
    // Dead since migration 019 removed water_logs, but it round-tripped through
    // /log's hot-path select, two components and this schema, with its own named
    // branch in the update route's error recovery — so the column could not be
    // dropped without 500ing profile updates (P2-3).
    const parsed = profileUpdateSchema.safeParse({
      display_name: 'Test',
      height_cm: 175,
      current_weight_kg: 80,
      target_weight_kg: 70,
      activity_level: 'moderate' as const,
      goal: 'lose' as const,
      water_target_ml: 2500,
    })
    expect(parsed.success).toBe(true)
    expect(parsed.success && 'water_target_ml' in parsed.data).toBe(false)
  })
})

/**
 * BMI math — single source of truth for the body-mass-index thresholds and the
 * healthy-weight range, shared by components/weight/BmiCard.tsx and the
 * onboarding target-weight step. Pure so it stays unit-testable (tests/bmi.test.ts).
 *
 * This module deliberately returns a neutral category *key* and *raw* (unrounded)
 * numbers: the two call sites render different labels ("Healthy" vs "Healthy
 * weight"), different colors, and round differently (Math.round vs toFixed), so
 * that presentation stays in the components and this refactor changes no output.
 */

export type BmiCategory = 'underweight' | 'healthy' | 'overweight' | 'obese'

/** Raw, unrounded BMI (kg/m²). */
export function computeBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100
  return weightKg / (heightM * heightM)
}

/** Standard WHO cutoffs: <18.5 / <25 / <30. */
export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight'
  if (bmi < 25) return 'healthy'
  if (bmi < 30) return 'overweight'
  return 'obese'
}

/** Raw kg bounds for the healthy BMI band (18.5–24.9) at a given height. */
export function healthyWeightRange(heightCm: number): { minKg: number; maxKg: number } {
  const heightM = heightCm / 100
  return { minKg: 18.5 * heightM * heightM, maxKg: 24.9 * heightM * heightM }
}

/** Target weights for a set of "goal" BMIs (default 20/22/24), raw kg. */
export function suggestedTargets(
  heightCm: number,
  bmis: number[] = [20, 22, 24],
): { bmi: number; kg: number }[] {
  const heightM = heightCm / 100
  return bmis.map((bmi) => ({ bmi, kg: bmi * heightM * heightM }))
}

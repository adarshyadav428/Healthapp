/**
 * The onboarding wizard is one <form> spanning all four steps, and every field
 * in `onboardingSchema` has a valid default (see OnboardingForm's useForm call)
 * while the schema itself has no cross-field rule. So the form validates the
 * instant a name is typed — and an implicit submit (Enter in any text/number
 * input on steps 2–4) would POST /api/onboarding with defaults for every field
 * the user hadn't reached, then jump straight to /onboarding/plan. Users saw
 * onboarding "vanish" mid-way and land on the welcome/plan screen.
 *
 * On steps 2–4 Enter now advances one step (via nextStep's per-step
 * validation) rather than doing nothing; only the final step submits.
 *
 * Asserted against the source rather than with a rendered form: this repo has
 * no testing-library / jsdom setup, and the bug lives in one line of JSX
 * wiring. Same approach as coachingWiring.test.ts.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const form = readFileSync(
  join(__dirname, '..', 'components', 'onboarding', 'OnboardingForm.tsx'),
  'utf8'
)

describe('onboarding wizard does not submit before the final step', () => {
  it('the <form> does not hand its onSubmit straight to form.handleSubmit', () => {
    // The original bug: `<form onSubmit={form.handleSubmit(onSubmit)}>` submits
    // on Enter from any step, because the whole schema is already valid.
    expect(form).not.toMatch(/<form\s+onSubmit=\{form\.handleSubmit\(onSubmit\)\}/)
  })

  it('routes submit through a guard that blocks steps before TOTAL_STEPS', () => {
    const guard = /const handleFormSubmit\s*=\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\s{2}\}/.exec(form)?.[1]
    expect(guard, 'handleFormSubmit moved or was renamed').toBeTruthy()
    // Below the last step: prevent the native submit, advance one step, bail.
    expect(guard).toMatch(/step\s*<\s*TOTAL_STEPS/)
    expect(guard).toContain('e.preventDefault()')
    expect(guard).toContain('nextStep()')
    // On the last step only, the real submit runs.
    expect(guard).toContain('form.handleSubmit(onSubmit)(e)')
  })

  it('the form element uses that guard', () => {
    expect(form).toMatch(/<form\s+onSubmit=\{handleFormSubmit\}/)
  })
})

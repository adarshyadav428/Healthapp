/**
 * The onboarding wizard persists its in-progress step + field values to
 * localStorage so a mid-wizard exit can resume (useOnboardingDraft.ts). That
 * key used to be one bare constant shared by every account on a browser, and
 * nothing ever clears it for an *abandoned* draft (only a successful submit
 * calls clearDraft()). So: start onboarding, get to step 3 or 4, close the
 * tab without finishing — the draft sits there forever. The next signup on
 * that same browser, a different account entirely, silently resumed at
 * whatever step the earlier draft left off at. Onboarding looked "skipped":
 * a brand-new user landed straight on the final step (or past it, onto
 * /dashboard) with someone else's half-filled answers.
 *
 * Fix: scope the storage key to the signed-in user's id, threaded down from
 * the server component that already has it. Asserted against the source
 * rather than a rendered hook: this repo has no testing-library / jsdom
 * setup. Same approach as onboardingFormWiring.test.ts.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const hook = readFileSync(
  join(__dirname, '..', 'hooks', 'useOnboardingDraft.ts'),
  'utf8'
)
const form = readFileSync(
  join(__dirname, '..', 'components', 'onboarding', 'OnboardingForm.tsx'),
  'utf8'
)
const page = readFileSync(
  join(__dirname, '..', 'app', 'onboarding', 'page.tsx'),
  'utf8'
)

describe('onboarding draft storage is scoped per user', () => {
  it('useOnboardingDraft takes a userId and builds a key from it', () => {
    expect(hook).toMatch(/useOnboardingDraft\s*\([^)]*userId\s*:\s*string/)
    expect(hook).toMatch(/storageKey\s*=\s*`[^`]*\$\{[^}]*userId[^}]*\}`/)
  })

  it('every localStorage call uses the scoped key, not a bare constant', () => {
    expect(hook).not.toMatch(/localStorage\.(getItem|setItem|removeItem)\(\s*ONBOARDING_STORAGE_KEY/)
    expect(hook).toMatch(/localStorage\.getItem\(\s*storageKey\s*\)/)
    expect(hook).toMatch(/localStorage\.setItem\(\s*\n?\s*storageKey/)
    expect(hook).toMatch(/localStorage\.removeItem\(\s*storageKey\s*\)/)
  })

  it('OnboardingForm accepts userId and forwards it to the draft hook', () => {
    expect(form).toMatch(/OnboardingForm\s*\(\s*\{\s*userId\s*\}\s*:\s*\{\s*userId:\s*string\s*\}\s*\)/)
    expect(form).toMatch(/useOnboardingDraft\(form,\s*userId\)/)
  })

  it('the onboarding page passes the authenticated user id down', () => {
    expect(page).toMatch(/<OnboardingForm\s+userId=\{user\.id\}\s*\/>/)
  })
})

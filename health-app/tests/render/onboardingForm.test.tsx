// @vitest-environment jsdom
/**
 * OnboardingForm — the one form in the app whose POST creates the profile
 * every downstream calculation reads.
 *
 * tests/onboardingFormWiring.test.ts already greps the source to prove the
 * wizard cannot submit before its final step (the bug where Enter on step 2
 * POSTed defaults for every field the user hadn't reached and jumped straight
 * to the plan screen). That is a source assertion; this is the behavioural
 * half — it walks the wizard the way a person does and asserts on the request
 * that comes out the end.
 *
 * WHAT THIS DELIBERATELY DOES NOT ASSERT
 * Not the copy, not the step layout, not which fields sit on which screen —
 * all of that is what Adarsh changes when he restyles, and none of it changes
 * what gets stored. Only two things are pinned: the wizard does not submit
 * early, and when it does submit it POSTs to /api/onboarding.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './support/renderWithProviders'
import { installFetchSpy } from './support/fetchSpy'
import { GHOST_CLICK_GUARD_MS } from '../../hooks/useOnboardingDraft'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/onboarding',
}))

vi.mock('../../lib/posthog/client', () => ({
  captureEvent: vi.fn(),
  logMetaHeaders: () => ({}),
  markLogStart: vi.fn(),
  markAppOpened: vi.fn(),
  identifyUser: vi.fn(),
  resetIdentity: vi.fn(),
}))

const { OnboardingForm } = await import('../../components/onboarding/OnboardingForm')

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/**
 * A controllable Date.now(), so the ghost-click guard's timing can be moved
 * past deterministically instead of by sleeping real wall-clock time in the
 * test. userEvent's own internal delays run on real timers regardless — this
 * only affects what the guard itself reads.
 */
function mockClock(startAt = 1_726_000_000_000) {
  let now = startAt
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  return { advance: (ms: number) => { now += ms } }
}

/**
 * Walk the wizard to its last step the way a user does.
 *
 * Driven by "is there still a Next button" rather than by the step counter's
 * text: the counter is presentation, and pinning a test to "3 / 4" makes
 * adding or reordering a screen fail a test that is supposed to be about the
 * POST contract. The loop bound is a guard against spinning, not a step count.
 */
async function walkToFinalStep() {
  await userEvent.click(screen.getByRole('button', { name: /skip for now/i }))

  // display_name is the one field with no valid default (''), so step 2 will
  // not advance until it is filled. Every other step's defaults pass.
  const name = await screen.findByPlaceholderText(/your name/i)
  await userEvent.type(name, 'Adarsh')

  // React reuses the Next button's DOM node between steps, so node identity is
  // not a change signal. The step counter's text is.
  const counter = () => screen.getByText(/^\d+ \/ \d+$/).textContent
  for (let i = 0; i < 6; i++) {
    const next = screen.queryByRole('button', { name: /^next$/i })
    if (!next) break
    const before = counter()
    await userEvent.click(next)
    await waitFor(() => expect(counter()).not.toBe(before))
  }

  return screen.findByRole('button', { name: /finish setup/i })
}

describe('the onboarding wizard does not submit before the final step', () => {
  it('sends nothing while walking steps 1 to 3', async () => {
    const spy = installFetchSpy({ '/api/onboarding': { ok: true } })
    renderWithProviders(<OnboardingForm />)

    await walkToFinalStep()

    // All the way to the last screen, still nothing posted. The original bug
    // POSTed on the first Enter keypress anywhere in the form, then jumped to
    // the plan screen — onboarding appearing to "vanish" mid-way.
    expect(spy.calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })
})

describe('the draft is scoped per account', () => {
  // Regression for the "delete account, sign up again → the wizard silently
  // opened on the deleted account's half-filled answers" secondary bug. The
  // draft key includes the authenticated user's id (see useOnboardingDraft's
  // draftStorageKey) precisely so a second account in the same browser — from
  // a second tab, or from signing up again after a delete — can never resume
  // a different account's in-progress wizard.
  it("a second account's wizard never resumes the first account's draft", async () => {
    installFetchSpy()
    const { unmount } = renderWithProviders(<OnboardingForm userId="user-a" />)
    await userEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    const nameA = await screen.findByPlaceholderText(/your name/i)
    await userEvent.type(nameA, 'Account A Name')
    await waitFor(() => {
      expect(window.localStorage.getItem('gis.onboarding.progress:user-a')).toContain('Account A Name')
    })
    unmount()

    renderWithProviders(<OnboardingForm userId="user-b" />)
    // A fresh account's wizard starts at step 1 (its own "skip for now" is
    // still there to click) — it would already be past step 1, on account
    // A's step, if it had resumed the wrong draft.
    await userEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    const nameB = await screen.findByPlaceholderText(/your name/i)
    expect(nameB).toHaveValue('')
  })
})

describe('finishing the wizard', () => {
  it('POSTs the profile to /api/onboarding', async () => {
    const clock = mockClock()
    const spy = installFetchSpy({ '/api/onboarding': { ok: true } })
    renderWithProviders(<OnboardingForm />)

    const finish = await walkToFinalStep()
    // Past the ghost-click guard window — this is a deliberate click well
    // after landing on the final step, not the same tap that reached it.
    clock.advance(GHOST_CLICK_GUARD_MS + 100)
    await userEvent.click(finish)

    await waitFor(() => {
      const body = spy.expectPosted('/api/onboarding').body as Record<string, unknown>
      // The route recomputes TDEE and macros server-side from these, so what
      // matters is that the measurements arrive at all — not their values,
      // which come from the wizard's own defaults here.
      expect(body).toBeTruthy()
      expect(Object.keys(body).length).toBeGreaterThan(3)
    })
  })
})

describe('the final step ignores an implausibly fast submit', () => {
  // Regression for "the last page gets skipped and lands on the plan
  // screen" — Android's WebView and iOS's installed-PWA mode can both fire a
  // tap's `click` event well after the touch that produced it, targeting
  // whatever now sits at those coordinates. "Next" (step 3) and "🎉 Finish
  // setup" (step 4) render in the same spot, so the tap that advances into
  // the final step can have its own delayed click land on the freshly
  // swapped submit button — submitting step 4's untouched defaults before a
  // person ever saw it. The guard in OnboardingForm's handleFormSubmit
  // ignores a submit that arrives implausibly soon after landing on the
  // final step, then accepts a later, genuine one normally.
  it('swallows a submit within the guard window, then accepts one after it', async () => {
    const clock = mockClock()
    const spy = installFetchSpy({ '/api/onboarding': { ok: true } })
    renderWithProviders(<OnboardingForm />)

    const finish = await walkToFinalStep()

    // No time has passed since landing on step 4 — this stands in for the
    // deferred ghost click from the tap that reached this step.
    await userEvent.click(finish)
    expect(spy.calls.filter((c) => c.method === 'POST')).toHaveLength(0)

    // A later, genuine click on the same button still works.
    clock.advance(GHOST_CLICK_GUARD_MS + 100)
    await userEvent.click(finish)
    await waitFor(() => {
      expect(spy.calls.filter((c) => c.method === 'POST')).toHaveLength(1)
    })
  })
})

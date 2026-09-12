// @vitest-environment jsdom
/**
 * SettingsClient — the Profile screen.
 *
 * Restyled 2026-09-11 into an identity row, a plan summary and grouped rows.
 * What a green run proves is that the restyle kept every control wired: the
 * plan summary shows the profile's own numbers, "Edit" opens the sheet whose
 * quick calorie save and full form still POST to /api/profile/update, Sign out
 * still POSTs to /api/auth/signout, the Pro row still reaches the manage flow
 * and the free row still links to /upgrade. Queried by role + accessible name
 * only; nothing here cares which div a row sits in.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Profile } from '../../types/index'
import { renderWithProviders } from './support/renderWithProviders'
import { installFetchSpy } from './support/fetchSpy'

const subscription = vi.hoisted(() => ({ view: null as Record<string, unknown> | null }))
const manage = vi.hoisted(() => ({ manageSubscription: vi.fn(), portalLoading: false }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/settings',
}))
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'system', setTheme: vi.fn() }) }))
vi.mock('../../hooks/useSubscription', () => ({ useSubscription: () => ({ data: subscription.view }) }))
vi.mock('../../hooks/useManageSubscription', () => ({ useManageSubscription: () => manage }))
vi.mock('../../lib/posthog/client', () => ({
  isAnalyticsOptedOut: () => false,
  setAnalyticsOptOut: vi.fn(),
}))

const { SettingsClient } = await import('../../components/settings/SettingsClient')

const PROFILE = {
  id: 'u1',
  email: 'a@b.c',
  display_name: 'Adarsh',
  height_cm: 175,
  current_weight_kg: 77.2,
  target_weight_kg: 72,
  age: 27,
  sex: 'male',
  activity_level: 'light',
  goal: 'lose',
  body_focus: 'fat_loss',
  pace_kg_per_week: 0.5,
  reminder_hour: 20,
  daily_calorie_target: 1800,
  protein_g_target: 130,
  carbs_g_target: 180,
  fat_g_target: 55,
  unit_system: 'metric',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
} as unknown as Profile

const PRO = {
  isPro: true,
  plan: 'annual',
  provider: 'razorpay',
  playProductId: null,
  expiresAt: '2027-03-12T00:00:00Z',
  subscription: { cancel_at_period_end: false },
}

function renderProfile() {
  return renderWithProviders(<SettingsClient profile={PROFILE} version="1.0.0" email="a@b.c" />)
}

beforeEach(() => {
  subscription.view = null
  manage.manageSubscription.mockReset()
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SettingsClient', () => {
  it('summarises the plan from the profile', () => {
    renderProfile()
    const plan = screen.getByRole('region', { name: 'Plan' })
    expect(within(plan).getByText('1,800')).toBeInTheDocument()
    expect(within(plan).getByText(/Lose fat/)).toBeInTheDocument()
    expect(within(plan).getByText('72.0 kg')).toBeInTheDocument()
    expect(within(plan).getByText('5 ft 9 in')).toBeInTheDocument()
  })

  it('shows the reminder hour on its row', () => {
    renderProfile()
    expect(screen.getByRole('button', { name: /Reminders/ })).toHaveTextContent('8:00 PM')
  })

  it('quick-saving a calorie goal POSTs the custom target', async () => {
    const fetchSpy = installFetchSpy()
    const user = userEvent.setup()
    renderProfile()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Edit' }))
    await user.click(within(dialog).getByRole('button', { name: '2,000' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      const call = fetchSpy.expectPosted('/api/profile/update')
      expect(call.body).toMatchObject({ custom_calorie_target: 2000, height_cm: 175, goal: 'lose' })
    })
  })

  it('the full form still saves the profile', async () => {
    const fetchSpy = installFetchSpy()
    const user = userEvent.setup()
    renderProfile()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => {
      const call = fetchSpy.expectPosted('/api/profile/update')
      expect(call.body).toMatchObject({ display_name: 'Adarsh', body_focus: 'fat_loss', target_weight_kg: 72 })
    })
  })

  it('sign out POSTs to the signout route', async () => {
    const fetchSpy = installFetchSpy()
    const user = userEvent.setup()
    renderProfile()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => fetchSpy.expectPosted('/api/auth/signout'))
  })

  it('a free account is offered Pro as a link, not a pitch', () => {
    renderProfile()
    expect(screen.getByRole('link', { name: /GetInShape Pro/ })).toHaveAttribute('href', '/upgrade')
    expect(screen.getByRole('link', { name: /Custom foods/ })).toHaveTextContent('Pro')
    expect(screen.queryByRole('button', { name: /Pro subscription/ })).not.toBeInTheDocument()
  })

  it('a Pro account sees its renewal and reaches the manage flow', async () => {
    subscription.view = PRO
    const user = userEvent.setup()
    renderProfile()
    const row = screen.getByRole('button', { name: /Pro subscription/ })
    expect(row).toHaveTextContent('Annual · renews 12 Mar 2027')
    await user.click(row)
    expect(manage.manageSubscription).toHaveBeenCalledTimes(1)
  })

  it('says "ends" once a cancellation is scheduled', () => {
    subscription.view = { ...PRO, plan: 'monthly', subscription: { cancel_at_period_end: true } }
    renderProfile()
    expect(screen.getByRole('button', { name: /Pro subscription/ })).toHaveTextContent('Monthly · ends 12 Mar 2027')
  })
})

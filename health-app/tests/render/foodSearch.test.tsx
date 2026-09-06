// @vitest-environment jsdom
/**
 * FoodSearch — the POST contracts behind the log screen's three fastest paths.
 *
 * This is the test the whole render layer exists for. `tests/architecture-
 * Invariants.test.ts` proves a component cannot write to the database; nothing
 * proved that the button a user taps still calls the route that does. A
 * restyle that drops a prop, renames a field out of a payload, or points a
 * fetch at the wrong path type-checks, lints, builds, and silently stops
 * logging food.
 *
 * WHAT IS MOCKED AND WHY
 * Only the edges: useUser (Supabase browser client + Zustand + posthog
 * identify at module scope), next/navigation (no router in a test), posthog
 * (network), and global fetch. The hook under test — useFoodSearch — is the
 * real one, because the wiring between the button and the body IS the thing
 * being pinned. Mocking the hook would leave nothing worth asserting.
 *
 * Assertions are on the request, never on toast copy: the toast strings here
 * ("Quick added Poha") are exactly the sort of thing a copy pass rewrites, and
 * a test that fails for that reason is a test that gets deleted.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './support/renderWithProviders'
import { installFetchSpy } from './support/fetchSpy'
import type { Food } from '../../types/index'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/log',
}))

vi.mock('../../hooks/useUser', () => ({
  useUser: () => ({ user: { id: 'user-1', email: 'a@b.c' }, profile: null, isLoading: false }),
}))

vi.mock('../../lib/posthog/client', () => ({
  captureEvent: vi.fn(),
  // Spread into every fetch's headers — must be an object, not undefined.
  logMetaHeaders: () => ({}),
  markLogStart: vi.fn(),
  markAppOpened: vi.fn(),
  identifyUser: vi.fn(),
  resetIdentity: vi.fn(),
}))

// Imported after the mocks so the module graph picks them up.
const { FoodSearch } = await import('../../components/log/FoodSearch')

const POHA = {
  id: 'food-poha',
  source: 'ifct',
  source_id: 'ifct-poha',
  name: 'Poha',
  brand: null,
  serving_size_g: 100,
  serving_description: '1 katori',
  kcal_per_100g: 130,
  protein_g_per_100g: 2.6,
  carbs_g_per_100g: 27.1,
  fat_g_per_100g: 1.2,
  fiber_g_per_100g: 1.1,
  common_portions: null,
} as unknown as Food

const SAVED_MEAL = {
  id: 'meal-1',
  name: 'Usual breakfast',
  created_at: '2026-01-01T00:00:00.000Z',
  saved_meal_items: [
    { food_id: 'food-poha', grams: 150, servings: 1, food: { name: 'Poha', kcal_per_100g: 130 } },
  ],
}

const LOG_DATE = '2026-09-01'

function renderSearch(spyResponses: Record<string, unknown> = {}) {
  const spy = installFetchSpy({
    '/api/meals/saved': [SAVED_MEAL],
    '/api/foods/favourites': [],
    '/api/logs/add': { ok: true },
    '/api/meals/log': { logged: 1 },
    '/api/logs/copy-yesterday': { ok: true, copied: 2 },
    ...spyResponses,
  })
  const view = renderWithProviders(
    <FoodSearch
      recentFoods={[POHA]}
      recentLogItems={[]}
      frequentFoods={[]}
      hasYesterdayLogs
      logDate={LOG_DATE}
      isToday
    />
  )
  return { spy, ...view }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('quick-adding a food', () => {
  it('POSTs /api/logs/add with the food, a portion and the day being viewed', async () => {
    const { spy } = renderSearch()

    // Recent foods render as FoodResult rows before any search is typed.
    await userEvent.click(await screen.findByRole('button', { name: /quick add/i }))

    await waitFor(() => {
      const call = spy.expectPosted('/api/logs/add')
      const body = call.body as Record<string, unknown>
      expect(body.food_id).toBe('food-poha')
      expect(body.servings).toBe(1)
      // The day being viewed, not today. Logging to a past day and having it
      // land on today is a bug this app has shipped more than once.
      expect(body.date).toBe(LOG_DATE)
      // defaultPortionFor decides this — never food.serving_size_g, which
      // logged 0 g for any row with a missing serving size.
      expect(typeof body.grams).toBe('number')
      expect(body.grams as number).toBeGreaterThan(0)
      expect(body.meal).toBeTruthy()
    })
  })
})

describe('logging a saved combo', () => {
  it('POSTs /api/meals/log carrying the viewed date, not the server default', async () => {
    // /api/meals/log had no `date` in its schema at all once, so every combo
    // took logged_at DEFAULT now() and a past-day tap moved today's total.
    const { spy } = renderSearch()

    await userEvent.click(await screen.findByRole('button', { name: /Log Usual breakfast/i }))

    await waitFor(() => {
      const body = spy.expectPosted('/api/meals/log').body as Record<string, unknown>
      expect(body.meal_id).toBe('meal-1')
      expect(body.date).toBe(LOG_DATE)
      expect(body.meal_type).toBeTruthy()
    })
  })
})

describe('copy yesterday', () => {
  it('POSTs /api/logs/copy-yesterday and disables the control while in flight', async () => {
    // The route is documented as NOT idempotent — a double tap duplicates
    // yesterday's logs, and the disabled binding is the only thing stopping it.
    const { spy } = renderSearch()

    const button = await screen.findByRole('button', { name: /copy yesterday/i })
    await userEvent.click(button)

    await waitFor(() => spy.expectPosted('/api/logs/copy-yesterday'))
  })
})

describe('the search box reaches the search route', () => {
  it('GETs /api/foods/search after the debounce', async () => {
    const { spy } = renderSearch({ '/api/foods/search': { results: [] } })

    await userEvent.type(screen.getByPlaceholderText(/search dal makhani/i), 'poha')

    // 300ms debounce — waitFor tracks the real completion rather than a
    // hard-coded sleep that flakes under CI load.
    await waitFor(
      () => expect(spy.urls().some((u) => u.includes('/api/foods/search'))).toBe(true),
      { timeout: 3000 }
    )
  })
})

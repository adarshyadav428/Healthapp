// @vitest-environment jsdom
/**
 * Hand-rolled full-screen overlays (AddFoodModal, UnitPicker, and — pinned
 * separately in cameraModal.test.tsx — CameraModal) must portal to
 * `document.body`.
 *
 * Why this exists: `app/log/page.tsx` wraps the search column in
 * `lg:sticky lg:top-6` for the desktop two-column layout. `position: sticky`
 * unconditionally creates a new CSS stacking context, regardless of
 * z-index. AddFoodModal (and CameraModal, and UnitPicker nested inside
 * AddFoodModal) mount from inside that column, so their `z-50`/`z-[60]` was
 * scoped to compare only against siblings inside that subtree —
 * BottomNav's `nav`, sitting outside it with an explicit `z-40`, painted
 * above the whole column regardless. Confirmed live at desktop width
 * (`lg:` ≥ 1024px) via `elementsFromPoint`: the "Add" button was completely
 * unreachable, resolving every click to BottomNav's camera FAB. Confirmed as
 * the fix by forcing the sticky ancestor to `position: static`.
 *
 * jsdom has no layout engine, so it can't reproduce the paint-order bug
 * itself — what it CAN pin, deterministically, is the actual mechanism of
 * the fix: the overlay's root node must not be a descendant of wherever it
 * was mounted, regardless of what stacking context that ancestor creates.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { renderWithProviders } from './support/renderWithProviders'
import { installFetchSpy } from './support/fetchSpy'
import type { Food } from '../../types/index'
import type { Unit } from '../../lib/portion-units'

vi.mock('../../hooks/useUser', () => ({
  useUser: () => ({ user: { id: 'user-1', email: 'a@b.c' }, profile: null, isLoading: false }),
}))

vi.mock('../../hooks/useDailyTotals', () => ({
  useDailyTotals: () => ({ totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, isLoading: false, error: null }),
}))

vi.mock('../../lib/posthog/client', () => ({
  captureEvent: vi.fn(),
  logMetaHeaders: () => ({}),
  markLogStart: vi.fn(),
  markAppOpened: vi.fn(),
  identifyUser: vi.fn(),
  resetIdentity: vi.fn(),
}))

const { AddFoodModal } = await import('../../components/log/AddFoodModal')
const { UnitPicker } = await import('../../components/log/UnitPicker')

const ROTI = {
  id: 'food-roti', source: 'ifct', source_id: 'ifct-roti', name: 'Roti', brand: null,
  serving_size_g: 40, serving_description: '1 piece', kcal_per_100g: 297,
  protein_g_per_100g: 9, carbs_g_per_100g: 56, fat_g_per_100g: 4, fiber_g_per_100g: 4,
  common_portions: null,
} as unknown as Food

const GRAM_UNIT: Unit = {
  key: 'g', label: 'Grams', toGrams: (n: number) => n, fromGrams: (g: number) => g,
} as unknown as Unit

/**
 * Stands in for `app/log/page.tsx`'s `lg:sticky` search column. Any ancestor
 * that creates a stacking context reproduces the same trap — sticky is just
 * the live example, so the test doesn't hard-code that specific mechanism.
 */
function StackingContextAncestor({ children }: { children: ReactNode }) {
  return (
    <div data-testid="stacking-ancestor" style={{ position: 'relative', zIndex: 0 }}>
      {children}
    </div>
  )
}

beforeEach(() => {
  window.scrollTo = vi.fn()
})

describe('AddFoodModal escapes any ancestor stacking context', () => {
  it('mounts as a sibling of its host tree, not a descendant of it', () => {
    installFetchSpy({ '/api/logs/add': { ok: true, row: null } })
    const { container } = renderWithProviders(
      <StackingContextAncestor>
        <AddFoodModal food={ROTI} onClose={vi.fn()} />
      </StackingContextAncestor>
    )

    const overlay = document.querySelector('.fixed.inset-0.z-50')
    expect(overlay).toBeTruthy()
    // The whole point of the fix: not nested inside the ancestor it opened from.
    expect(container.contains(overlay)).toBe(false)
    expect(overlay!.parentElement).toBe(document.body)
  })

  it('the Add button is still reachable and still submits', async () => {
    const spy = installFetchSpy({ '/api/logs/add': { ok: true, row: null } })
    renderWithProviders(
      <StackingContextAncestor>
        <AddFoodModal food={ROTI} onClose={vi.fn()} />
      </StackingContextAncestor>
    )

    const addButton = screen.getByRole('button', { name: 'Add' })
    expect(addButton).toBeEnabled()
    await userEvent.click(addButton)

    spy.expectPosted('/api/logs/add')
  })
})

describe('UnitPicker escapes any ancestor stacking context', () => {
  it('mounts as a sibling of its host tree, not a descendant of it', () => {
    const { container } = render(
      <StackingContextAncestor>
        <UnitPicker foodName="Roti" units={[GRAM_UNIT]} selected={GRAM_UNIT} onSelect={vi.fn()} onClose={vi.fn()} />
      </StackingContextAncestor>
    )

    const overlay = document.querySelector('.fixed.inset-0.z-\\[60\\]')
    expect(overlay).toBeTruthy()
    expect(container.contains(overlay)).toBe(false)
    expect(overlay!.parentElement).toBe(document.body)
  })
})

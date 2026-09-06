// @vitest-environment jsdom
/**
 * FoodResult — the search-result row, and the first render test in this repo.
 *
 * WHY THIS EXISTS
 * Every other spec here either exercises a pure lib/ function or greps source
 * text. Neither can see the failure mode that actually follows a restyle: the
 * markup moves, the component still compiles, tsc still passes, and a control
 * quietly stops being wired to anything. `onQuickAdd` dropped from a prop
 * spread is a one-line diff that no gate in this project could previously
 * catch.
 *
 * HOW THESE ARE WRITTEN SO A RESKIN DOESN'T BREAK THEM
 * Queried by role + accessible name only, never by class or DOM shape. This
 * component already carries the right hooks (aria-label="Quick add", and a
 * favourite button whose label states its own state). Restyling the Tailwind,
 * reordering the divs or swapping the icon leaves every assertion below
 * untouched — which is the whole point. No snapshots: a snapshot of markup
 * fails on every restyle by construction, which is the "so I disabled the
 * tests" failure mode, automated.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FoodResult } from '../../components/log/FoodResult'
import type { Food } from '../../types/index'

const FOOD = {
  id: 'food-1',
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

describe('FoodResult is wired to its callbacks', () => {
  it('quick add calls onQuickAdd with the food', async () => {
    const onQuickAdd = vi.fn()
    render(<FoodResult food={FOOD} onSelect={vi.fn()} onQuickAdd={onQuickAdd} />)

    await userEvent.click(screen.getByRole('button', { name: /quick add/i }))

    expect(onQuickAdd).toHaveBeenCalledTimes(1)
    expect(onQuickAdd).toHaveBeenCalledWith(FOOD)
  })

  it('tapping the row itself calls onSelect, not onQuickAdd', async () => {
    const onSelect = vi.fn()
    const onQuickAdd = vi.fn()
    render(<FoodResult food={FOOD} onSelect={onSelect} onQuickAdd={onQuickAdd} />)

    // The row body is its own button; its accessible name is the food's text.
    await userEvent.click(screen.getByRole('button', { name: /poha/i }))

    expect(onSelect).toHaveBeenCalledWith(FOOD)
    expect(onQuickAdd).not.toHaveBeenCalled()
  })

  it('the favourite toggle calls onToggleFavourite and names its own state', async () => {
    const onToggleFavourite = vi.fn()
    const { rerender } = render(
      <FoodResult food={FOOD} onSelect={vi.fn()} isFavourite={false} onToggleFavourite={onToggleFavourite} />
    )

    await userEvent.click(screen.getByRole('button', { name: /add to favourites/i }))
    expect(onToggleFavourite).toHaveBeenCalledWith(FOOD)

    // The label is the only signal a user gets for which way the toggle goes.
    rerender(
      <FoodResult food={FOOD} onSelect={vi.fn()} isFavourite onToggleFavourite={onToggleFavourite} />
    )
    expect(screen.getByRole('button', { name: /remove from favourites/i })).toBeInTheDocument()
  })
})

describe('FoodResult renders only the controls it was given', () => {
  it('omits quick add when no handler is passed', () => {
    render(<FoodResult food={FOOD} onSelect={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /quick add/i })).toBeNull()
  })

  it('omits the favourite toggle when no handler is passed', () => {
    render(<FoodResult food={FOOD} onSelect={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /favourites/i })).toBeNull()
  })

  it('disables quick add while a add is in flight', () => {
    // The guard against double-logging one tap. A restyle that drops the
    // disabled binding logs the food twice and looks fine.
    render(<FoodResult food={FOOD} onSelect={vi.fn()} onQuickAdd={vi.fn()} isQuickAdding />)
    expect(screen.getByRole('button', { name: /quick add/i })).toBeDisabled()
  })
})

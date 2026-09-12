// @vitest-environment jsdom
/**
 * CameraModal — the AI result sheet and the logged confirmation.
 *
 * The hook (useCameraScan) owns every side effect: the camera stream, the
 * analyze call, the log write. It is mocked wholesale here so the test can
 * hand the view a finished result and check that each control is still wired
 * to the hook action it exists for. Queried by role + accessible name only,
 * so a restyle leaves every assertion untouched (see foodResult.test.tsx).
 *
 * What a green run proves: the name, the calories, the quantity nudges, the
 * meal choice, the feedback chips and the one primary action all reach the
 * hook — and that the confirmation screen says what was logged and hands
 * "Done" to onClose.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Food } from '../../types/index'

const hook = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}))

vi.mock('../../hooks/useCameraScan', () => ({
  useCameraScan: () => hook.state,
}))

import { CameraModal } from '../../components/camera/CameraModal'

const BIRYANI = {
  id: 'food-biryani',
  source: 'ifct',
  source_id: 'ifct-biryani',
  name: 'Chicken Biryani',
  brand: null,
  serving_size_g: 250,
  serving_description: '1 plate',
  kcal_per_100g: 216,
  protein_g_per_100g: 9,
  carbs_g_per_100g: 27,
  fat_g_per_100g: 7,
  fiber_g_per_100g: 1,
  common_portions: null,
} as unknown as Food

function resultState(overrides: Record<string, unknown> = {}) {
  const noop = vi.fn()
  return {
    videoRef: { current: null }, canvasRef: { current: null }, galleryRef: { current: null },
    barcodeSupport: false, mode: 'photo', camError: null, barcodeLoading: false,
    captured: 'data:image/jpeg;base64,AAAA', analyzing: false,
    results: [{ food: BIRYANI, estimated_grams: 300, unit: 'g', grams: 300, name: 'Chicken Biryani' }],
    selected: { food: BIRYANI, estimated_grams: 300, unit: 'g', grams: 300, name: 'Chicken Biryani' },
    selectedIdx: 0, confidence: 'high', scansLeft: null, grams: 300,
    photoContext: '', showContextInput: false, meal: 'lunch', logging: false,
    manualBarcode: '', manualLoading: false, customName: 'Chicken Biryani', editingName: false,
    feedback: null, logged: null,
    setGrams: vi.fn(), setPhotoContext: noop, setShowContextInput: noop, setMeal: vi.fn(),
    setManualBarcode: noop, setCustomName: noop, setEditingName: noop,
    onGallerySelect: noop, capturePhoto: noop, analyzePhoto: noop, submitManualBarcode: noop,
    retake: vi.fn(), switchMode: noop, selectResult: noop, logFood: vi.fn(), rateResult: vi.fn(),
    kcal: 648, protein: 27, carbs: 81, fat: 21, coaching: null,
    amountMin: 10, amountMax: 1500, amountStep: 5,
    multiItem: false, totalKcal: 648, totalProtein: 27, totalCarbs: 81, totalFat: 21,
    ...overrides,
  }
}

beforeEach(() => {
  hook.state = resultState()
  // useScrollLock restores the scroll position on unmount; jsdom has no scrollTo.
  window.scrollTo = vi.fn()
})

describe('the AI result sheet', () => {
  it('shows what was recognised and what it costs', () => {
    render(<CameraModal onClose={vi.fn()} onFoodFound={vi.fn()} />)
    expect(screen.getByRole('button', { name: /edit name: chicken biryani/i })).toBeInTheDocument()
    expect(screen.getByText('648')).toBeInTheDocument()
  })

  it('the primary action names the meal and the calories, and logs', async () => {
    render(<CameraModal onClose={vi.fn()} onFoodFound={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /add to lunch · 648 kcal/i }))
    expect(hook.state.logFood).toHaveBeenCalledTimes(1)
  })

  it('− and + nudge the quantity by 25 g inside the portion range', async () => {
    render(<CameraModal onClose={vi.fn()} onFoodFound={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /increase quantity/i }))
    expect(hook.state.setGrams).toHaveBeenLastCalledWith(325)
    await userEvent.click(screen.getByRole('button', { name: /decrease quantity/i }))
    expect(hook.state.setGrams).toHaveBeenLastCalledWith(275)
  })

  it('the quantity can also be typed', async () => {
    render(<CameraModal onClose={vi.fn()} onFoodFound={vi.fn()} />)
    const field = screen.getByRole('spinbutton', { name: /quantity/i })
    await userEvent.clear(field)
    await userEvent.type(field, '180')
    expect(hook.state.setGrams).toHaveBeenLastCalledWith(180)
  })

  it('the meal is a radio group with the current slot checked', async () => {
    render(<CameraModal onClose={vi.fn()} onFoodFound={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'Lunch' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: 'Dinner' }))
    expect(hook.state.setMeal).toHaveBeenCalledWith('dinner')
  })

  it('the feedback chips reach rateResult', async () => {
    render(<CameraModal onClose={vi.fn()} onFoodFound={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Not sure' }))
    expect(hook.state.rateResult).toHaveBeenCalledWith('unsure')
  })

  it('a low-confidence result is flagged next to the name', () => {
    hook.state = resultState({ confidence: 'low' })
    render(<CameraModal onClose={vi.fn()} onFoodFound={vi.fn()} />)
    expect(screen.getByText(/check this one/i)).toBeInTheDocument()
  })

  it('a multi-food plate lists every item and adds them all', () => {
    const roti = { food: { ...BIRYANI, id: 'food-roti', name: 'Roti' }, estimated_grams: 70, unit: 'g', grams: 70, name: 'Roti' }
    const items = [hook.state.selected, roti]
    hook.state = resultState({ results: items, multiItem: true, totalKcal: 850 })
    render(<CameraModal onClose={vi.fn()} onFoodFound={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^roti/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add 2 foods to lunch · 850 kcal/i })).toBeInTheDocument()
  })
})

describe('the logged confirmation', () => {
  it('says what went in, where the day stands, and Done closes', async () => {
    const onClose = vi.fn()
    hook.state = resultState({
      logged: { name: 'Chicken Biryani', count: 1, kcal: 648, meal: 'lunch', dayKcal: 1240, dayTarget: 1800 },
    })
    render(<CameraModal onClose={onClose} onFoodFound={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /logged to lunch/i })).toBeInTheDocument()
    expect(screen.getByText(/560 left/)).toBeInTheDocument()
    // The result sheet is gone — no second "Add to" action behind the confirmation.
    expect(screen.queryByRole('button', { name: /add to lunch/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('says nothing about the day when the day was not known', () => {
    hook.state = resultState({
      logged: { name: 'Chicken Biryani', count: 1, kcal: 648, meal: 'snack', dayKcal: null, dayTarget: 1800 },
    })
    render(<CameraModal onClose={vi.fn()} onFoodFound={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /logged to snack/i })).toBeInTheDocument()
    expect(screen.queryByText(/left/)).not.toBeInTheDocument()
  })
})

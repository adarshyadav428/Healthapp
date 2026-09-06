// @vitest-environment jsdom
/**
 * components/log/shortcuts.tsx — the re-log / combo / copy-yesterday controls
 * that both FoodLanding and FoodSearch render.
 *
 * These tiles were implemented twice once, with different ordering and
 * different meal-selection behaviour, which is how the same shortcut came to
 * mean two things (see CLAUDE.md). They are one shared module now, and that
 * makes them the highest-leverage thing in the log screen to pin: a wiring
 * mistake here is a wiring mistake on every logging surface at once.
 *
 * Queried by accessible name throughout — these controls are icon-only, so the
 * aria-label IS the affordance. A restyle that drops one doesn't just break a
 * test, it makes the button unreachable for anyone using a screen reader.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShortcutRow, CopyYesterdayButton } from '../../components/log/shortcuts'

const row = (over: Partial<Parameters<typeof ShortcutRow>[0]> = {}) => ({
  name: 'Poha',
  detail: '130 kcal',
  tile: <span>🍚</span>,
  busy: false,
  disabled: false,
  actionLabel: 'Log Poha again',
  onAdd: vi.fn(),
  ...over,
})

describe('ShortcutRow', () => {
  it('the add button calls onAdd', async () => {
    const props = row()
    render(<ShortcutRow {...props} />)

    await userEvent.click(screen.getByRole('button', { name: 'Log Poha again' }))

    expect(props.onAdd).toHaveBeenCalledTimes(1)
  })

  it('renders no delete button unless onDelete is given', () => {
    render(<ShortcutRow {...row()} />)
    // Only the add button exists.
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('the delete button calls onDelete and does not also add', async () => {
    const onAdd = vi.fn()
    const onDelete = vi.fn()
    render(<ShortcutRow {...row({ onAdd, onDelete })} />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete Poha' }))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('is disabled while an add is in flight', () => {
    // `disabled` is the only thing stopping a double-tap logging twice.
    render(<ShortcutRow {...row({ busy: true, disabled: true })} />)
    expect(screen.getByRole('button', { name: 'Log Poha again' })).toBeDisabled()
  })
})

describe('CopyYesterdayButton', () => {
  it('calls onClick', async () => {
    const onClick = vi.fn()
    render(<CopyYesterdayButton copying={false} onClick={onClick} />)

    await userEvent.click(screen.getByRole('button', { name: /copy yesterday/i }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disables itself while copying', () => {
    // /api/logs/copy-yesterday is documented as NOT idempotent — a double tap
    // duplicates yesterday's logs. This disabled binding is the only guard.
    render(<CopyYesterdayButton copying onClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: /copying/i })).toBeDisabled()
  })
})

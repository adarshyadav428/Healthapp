'use client'

import { Copy, Layers, Loader2, Plus, Trash2 } from 'lucide-react'
import { foodEmoji, tintFor } from '../../lib/foodVisual'

/**
 * The repeat-logging shortcuts, in one place.
 *
 * These rows — re-log, saved combo, copy-yesterday — existed twice: once on
 * FoodLanding and again inside FoodSearch, in two different visual languages,
 * with different ordering and different meal-selection behaviour. Two
 * implementations of the fastest path in the app is two places for it to drift,
 * and it had already drifted.
 *
 * The Food tab's styling wins because it is what a user sees first: search now
 * matches the default screen rather than the other way round.
 */

const AIR = { boxShadow: 'var(--shadow-air)' } as const

export function EmojiTile({ name }: { name: string }) {
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control"
      style={{ backgroundColor: `color-mix(in srgb, ${tintFor(name)} 14%, transparent)` }}
    >
      <span className="text-title leading-none" aria-hidden="true">{foodEmoji(name)}</span>
    </div>
  )
}

/** The gradient + affordance every shortcut row ends in. */
function AddButton({ busy, label, onClick, disabled }: {
  busy: boolean
  label: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink tap-scale disabled:opacity-50"
      style={{ boxShadow: 'var(--fab-shadow)' }}
    >
      {busy
        ? <Loader2 className="h-4 w-4 animate-spin text-canvas" />
        : <Plus className="h-[18px] w-[18px] text-canvas" strokeWidth={2.2} />}
    </button>
  )
}

export function ShortcutRow({ name, detail, tile, busy, disabled, actionLabel, onAdd, onDelete, deleteLabel }: {
  name: string
  detail: React.ReactNode
  tile: React.ReactNode
  busy: boolean
  disabled: boolean
  actionLabel: string
  onAdd: () => void
  onDelete?: () => void
  deleteLabel?: string
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-card bg-surface p-3" style={AIR}>
      {tile}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-semibold text-ink">{name}</p>
        <p className="mt-[3px] text-caption text-ink-3">{detail}</p>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel ?? `Delete ${name}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-3 tap-scale"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      <AddButton busy={busy} label={actionLabel} onClick={onAdd} disabled={disabled} />
    </div>
  )
}

/** A saved meal template. */
export function ComboTile() {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-brand-soft">
      <Layers className="h-5 w-5 text-brand" strokeWidth={2} />
    </div>
  )
}

export function ShortcutHeading({ title, hint }: { title: string; hint?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline gap-2 px-0.5">
      <p className="text-body-lg font-semibold text-ink">{title}</p>
      {hint && <span className="text-caption text-ink-3">{hint}</span>}
    </div>
  )
}

export function CopyYesterdayButton({ copying, onClick }: { copying: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={copying}
      className="flex w-full items-center gap-3 rounded-card bg-surface p-4 text-left tap-scale disabled:opacity-50"
      style={AIR}
    >
      <Copy className="h-[18px] w-[18px] shrink-0 text-brand" strokeWidth={2} />
      <span className="text-body font-semibold text-ink">
        {copying ? 'Copying…' : "Copy yesterday's meals"}
      </span>
    </button>
  )
}

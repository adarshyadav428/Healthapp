'use client'

import { Copy, Layers, Loader2, Plus, Trash2 } from 'lucide-react'
import { foodEmoji, tintFor } from '../../lib/foodVisual'
import { cn } from '../../lib/utils'

/**
 * The repeat-logging shortcuts, in one place.
 *
 * These rows — re-log, saved combo, copy-yesterday — existed twice: once on
 * FoodLanding and again inside FoodSearch, in two different visual languages,
 * with different ordering and different meal-selection behaviour. Two
 * implementations of the fastest path in the app is two places for it to drift,
 * and it had already drifted.
 *
 * Every row here is a list row, not a card: a 44px tile, name over one line of
 * context, and a 44px "+" at the end. Rows sit on the canvas separated by
 * hairlines — the still surface is the page; the data is what moves.
 */

/**
 * A food's tile: its emoji on a soft, lit square. The tint is one of the macro
 * tokens (lib/foodVisual), laid as a light-from-top-left gradient with a
 * hairline of the same hue, so a column of tiles reads as small objects with
 * depth rather than flat coloured boxes.
 */
export function EmojiTile({ name, className }: { name: string; className?: string }) {
  const tint = tintFor(name)
  return (
    <div
      className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-control', className)}
      style={{
        backgroundImage: `linear-gradient(145deg, color-mix(in srgb, ${tint} 26%, var(--surface)) 0%, color-mix(in srgb, ${tint} 8%, var(--surface)) 100%)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tint} 18%, transparent)`,
      }}
    >
      <span className="text-title-sm leading-none" aria-hidden="true">{foodEmoji(name)}</span>
    </div>
  )
}

/** The one add affordance every row ends in — 44px, soft ember so a column
 *  of them reads as a list of actions, not a wall of buttons. */
export function AddButton({ busy, label, onClick, disabled }: {
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
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-brand-text tap-scale transition-[opacity,filter] hover:brightness-95 disabled:opacity-40"
      style={{
        backgroundImage: 'linear-gradient(145deg, color-mix(in srgb, var(--brand) 18%, var(--surface)) 0%, color-mix(in srgb, var(--brand) 8%, var(--surface)) 100%)',
        boxShadow: 'inset 0 0 0 1px var(--brand-ring)',
      }}
    >
      {busy
        ? <Loader2 className="h-5 w-5 animate-spin" />
        : <Plus className="h-5 w-5" strokeWidth={2} />}
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
    <div className="flex items-center gap-3 py-2.5">
      {tile}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-ink">{name}</p>
        <p className="mt-0.5 truncate text-caption text-ink-3">{detail}</p>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel ?? `Delete ${name}`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-3 tap-scale hover:bg-surface-2 hover:text-ink"
        >
          <Trash2 className="h-5 w-5" strokeWidth={1.75} />
        </button>
      )}
      <AddButton busy={busy} label={actionLabel} onClick={onAdd} disabled={disabled} />
    </div>
  )
}

export const BRAND_TILE = {
  backgroundImage: 'linear-gradient(145deg, color-mix(in srgb, var(--brand) 22%, var(--surface)) 0%, color-mix(in srgb, var(--brand) 8%, var(--surface)) 100%)',
  boxShadow: 'inset 0 0 0 1px var(--brand-ring)',
} as const

/** A saved meal template. */
export function ComboTile() {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control" style={BRAND_TILE}>
      <Layers className="h-5 w-5 text-brand" strokeWidth={1.75} />
    </div>
  )
}

/** A copied meal section, waiting to be pasted onto the day being viewed. */
export function MealTile({ emoji }: { emoji: string }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control" style={BRAND_TILE}>
      <span className="text-title-sm leading-none" aria-hidden="true">{emoji}</span>
    </div>
  )
}

/** A section title for a list of rows: sans, caption, ink-2 — never a card. */
export function ShortcutHeading({ title, hint }: { title: string; hint?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1 pb-1 pt-4">
      <p className="text-caption font-semibold text-ink-2">{title}</p>
      {hint && <span className="truncate text-caption text-ink-3">{hint}</span>}
    </div>
  )
}

export function CopyYesterdayButton({ copying, onClick }: { copying: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={copying}
      className="flex h-12 w-full items-center gap-3 rounded-control px-1 text-left text-body font-medium text-ink tap-scale transition-colors hover:bg-surface-2 disabled:opacity-40"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-surface-2 text-ink-2">
        <Copy className="h-5 w-5" strokeWidth={1.75} />
      </span>
      {copying ? 'Copying…' : "Copy yesterday's meals"}
    </button>
  )
}

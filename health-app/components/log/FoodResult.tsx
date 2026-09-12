import type { Food } from '../../types/index'
import { Star } from 'lucide-react'
import { defaultPortionFor, isLiquidFood } from '../../lib/portion-units'
import type { LastPortion } from '../../lib/lastPortions'
import { AddButton, EmojiTile } from './shortcuts'

// Provenance (IFCT / Open Food Facts / branded / estimated) used to render as
// a badge on every card here, asking the user to arbitrate which source to
// trust for a food that showed up more than once — an arbitration
// `SOURCE_RANK` (lib/foodMatch.ts) already resolves at search time via
// `collapseDuplicateFoods` (lib/mergeSearchResults.ts), which is what makes
// showing more than one row for the same food, at different numbers, no
// longer possible. `user` is the one badge kept: it names *ownership* ("a
// food you made"), which the user can act on, not provenance they can't.
const SOURCE_BADGE: Record<string, string> = {
  user: 'Custom',
}

const unitFor = (name: string) => (isLiquidFood(name) ? 'ml' : 'g')

/**
 * The one line under a food's name: what "+" will log, and what it costs.
 * A food logged before shows the portion it went in at last time — that is
 * exactly what "+" re-logs. A new food shows the default portion the sheet
 * will open on. Both are display only; the grams come from the same
 * defaultPortionFor / last-log values the logging paths use.
 */
export function portionContext(food: Food, last?: LastPortion): string {
  if (last) {
    return `Last time ${Math.round(last.grams)} ${unitFor(food.name)} · ${Math.round(last.kcal)} kcal`
  }
  const { unit, quantity, grams } = defaultPortionFor(food)
  const kcal = Math.round((food.kcal_per_100g * grams) / 100)
  // "1 medium roti", not "1 medium roti (35g)" — the row has one line.
  const label = unit.label.replace(/\s*\(.*\)\s*$/, '').toLowerCase()
  const amount = unit.key === 'g' ? `${Math.round(grams)} ${unitFor(food.name)}` : `${quantity} ${label}`
  return `${amount} · ${kcal} kcal`
}

export function FoodResult({
  food,
  onSelect,
  onQuickAdd,
  isQuickAdding,
  isFavourite,
  onToggleFavourite,
  lastPortion,
}: {
  food: Food
  onSelect: (food: Food) => void
  onQuickAdd?: (food: Food) => void
  isQuickAdding?: boolean
  isFavourite?: boolean
  onToggleFavourite?: (food: Food) => void
  /** How this food was last logged, if ever — shown as the row's context line. */
  lastPortion?: LastPortion
}) {
  const badge = SOURCE_BADGE[food.source]

  return (
    <div className="flex items-center gap-3 py-2.5">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-control text-left tap-scale"
        onClick={() => onSelect(food)}
      >
        <EmojiTile name={food.name} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="line-clamp-2 text-body font-medium leading-snug text-ink">{food.name}</span>
            {badge && (
              <span className="shrink-0 rounded-full bg-brand-soft px-2 text-micro font-semibold text-brand-text">
                {badge}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-caption text-ink-3">
            {food.brand ? `${food.brand} · ` : ''}
            {portionContext(food, lastPortion)}
          </span>
        </span>
      </button>

      {onToggleFavourite && (
        <button
          type="button"
          onClick={() => onToggleFavourite(food)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full tap-scale transition-colors hover:bg-surface-2"
          aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
        >
          <Star
            className={isFavourite ? 'h-5 w-5 fill-energy text-energy' : 'h-5 w-5 text-ink-3'}
            strokeWidth={1.5}
          />
        </button>
      )}

      {onQuickAdd ? (
        <AddButton
          busy={Boolean(isQuickAdding)}
          label={`Quick add ${food.name}`}
          onClick={() => onQuickAdd(food)}
          disabled={Boolean(isQuickAdding)}
        />
      ) : null}
    </div>
  )
}

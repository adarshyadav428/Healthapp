import type { Food } from '../../types/index'
import { Loader2, Plus, Star } from 'lucide-react'

// Only sources that change what the user would *do* get a badge. Open Food
// Facts is the default for anything packaged, so labelling it said nothing
// while taking ~45% of the row — which is what was clipping the food name.
const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  ifct:       { label: '🇮🇳 IFCT',      color: 'bg-brand-soft text-brand-ink' },
  user:       { label: '👤 Custom',     color: 'bg-brand-soft text-brand-ink' },
  branded:    { label: '🏷️ Branded',    color: 'bg-surface-2 text-ink-2' },
  restaurant: { label: '🍽️ Restaurant', color: 'bg-surface-2 text-ink-2' },
  curated:    { label: '📊 Estimated',  color: 'bg-energy-soft text-energy-ink' },
  estimate:   { label: '📊 Est.',       color: 'bg-energy-soft text-energy-ink' },
}

export function FoodResult({
  food,
  onSelect,
  onQuickAdd,
  isQuickAdding,
  isFavourite,
  onToggleFavourite,
}: {
  food: Food
  onSelect: (food: Food) => void
  onQuickAdd?: (food: Food) => void
  isQuickAdding?: boolean
  isFavourite?: boolean
  onToggleFavourite?: (food: Food) => void
}) {
  const badge = SOURCE_BADGE[food.source]

  return (
    <div className="flex w-full items-center gap-2 rounded-card border border-hairline bg-surface px-4 py-3 shadow-rest hover:border-brand-ring transition-all">
      <button type="button" className="flex-1 min-w-0 text-left" onClick={() => onSelect(food)}>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink leading-tight line-clamp-2">{food.name}</p>
          {food.brand && <p className="text-[11px] text-ink-2 truncate">{food.brand}</p>}
        </div>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="text-xs font-bold text-ink tabular-nums">{Math.round(food.kcal_per_100g)} kcal</span>
          <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--protein)' }}>P {Math.round(food.protein_g_per_100g)}g</span>
          <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--carbs)' }}>C {Math.round(food.carbs_g_per_100g)}g</span>
          <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--fat)' }}>F {Math.round(food.fat_g_per_100g)}g</span>
          {food.fiber_g_per_100g != null && food.fiber_g_per_100g > 0 && (
            <span className="text-xs font-medium text-good tabular-nums">Fi {Math.round(food.fiber_g_per_100g)}g</span>
          )}
          <span className="text-[10px] text-ink-2">per 100g</span>
          {badge && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.color}`}>
              {badge.label}
            </span>
          )}
        </div>
      </button>

      {onToggleFavourite && (
        <button
          type="button"
          onClick={() => onToggleFavourite(food)}
          className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-control transition-colors hover:bg-energy-soft"
          aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
        >
          <Star
            className={`h-4 w-4 transition-colors ${
              isFavourite
                ? 'fill-energy text-energy'
                : 'text-hairline hover:text-energy'
            }`}
          />
        </button>
      )}

      {onQuickAdd ? (
        <button
          type="button"
          onClick={() => onQuickAdd(food)}
          disabled={isQuickAdding}
          className="h-9 w-9 flex-shrink-0 rounded-control bg-brand text-white flex items-center justify-center hover:opacity-90 active:scale-90 disabled:opacity-50 transition-all shadow-rest"
          aria-label="Quick add"
        >
          {isQuickAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  )
}

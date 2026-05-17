import type { Food } from '../../types/index'
import { Loader2, Plus, Star } from 'lucide-react'

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  ifct:     { label: '🇮🇳 Indian', color: 'bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400' },
  usda:     { label: '🇺🇸 USDA',   color: 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' },
  user:     { label: '👤 Custom',  color: 'bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400' },
  off:      { label: '🌍 Global',  color: 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400' },
  estimate: { label: '📊 Est.',    color: 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
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
  const badge = SOURCE_BADGE[food.source] ?? SOURCE_BADGE.off

  return (
    <div className="flex w-full items-center gap-2 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900/80 px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:border-orange-200 dark:hover:border-orange-800 hover:shadow-md transition-all">
      <button type="button" className="flex-1 min-w-0 text-left" onClick={() => onSelect(food)}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate leading-tight">{food.name}</p>
            {food.brand && <p className="text-[11px] text-muted truncate">{food.brand}</p>}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.color}`}>
            {badge.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="text-xs font-black text-foreground">{Math.round(food.kcal_per_100g)} kcal</span>
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">P {Math.round(food.protein_g_per_100g)}g</span>
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">C {Math.round(food.carbs_g_per_100g)}g</span>
          <span className="text-xs font-medium text-rose-500 dark:text-rose-400">F {Math.round(food.fat_g_per_100g)}g</span>
          {food.fiber_g_per_100g != null && food.fiber_g_per_100g > 0 && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Fi {Math.round(food.fiber_g_per_100g)}g</span>
          )}
          <span className="text-[10px] text-muted">per 100g</span>
        </div>
      </button>

      {onToggleFavourite && (
        <button
          type="button"
          onClick={() => onToggleFavourite(food)}
          className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-xl transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/20"
          aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
        >
          <Star
            className={`h-4 w-4 transition-colors ${
              isFavourite
                ? 'fill-amber-400 text-amber-400'
                : 'text-gray-300 dark:text-slate-600 hover:text-amber-400'
            }`}
          />
        </button>
      )}

      {onQuickAdd ? (
        <button
          type="button"
          onClick={() => onQuickAdd(food)}
          disabled={isQuickAdding}
          className="h-9 w-9 flex-shrink-0 rounded-2xl bg-orange-600 text-white flex items-center justify-center hover:bg-orange-700 active:scale-90 disabled:opacity-50 transition-all shadow-sm"
          aria-label="Quick add"
        >
          {isQuickAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  )
}

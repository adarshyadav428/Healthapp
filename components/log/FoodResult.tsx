import type { Food } from '../../types/index'
import { ChevronRight, Plus } from 'lucide-react'

export function FoodResult({
  food,
  onSelect,
  onQuickAdd,
  isQuickAdding,
}: {
  food: Food
  onSelect: (food: Food) => void
  onQuickAdd?: (food: Food) => void
  isQuickAdding?: boolean
}) {
  return (
    <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 text-left shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <button
        type="button"
        className="flex-1 min-w-0 text-left hover:opacity-90"
        onClick={() => onSelect(food)}
      >
        <p className="text-sm font-semibold text-gray-900 truncate">{food.name}</p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-xs font-medium text-gray-700">{Math.round(food.kcal_per_100g)} kcal</span>
          <span className="text-xs text-emerald-600">P {Math.round(food.protein_g_per_100g)}g</span>
          <span className="text-xs text-amber-600">C {Math.round(food.carbs_g_per_100g)}g</span>
          <span className="text-xs text-rose-500">F {Math.round(food.fat_g_per_100g)}g</span>
          <span className="text-xs text-gray-400">per 100g</span>
        </div>
        {food.brand && <p className="text-xs text-gray-400 mt-0.5">{food.brand}</p>}
      </button>

      <div className="flex items-center gap-2">
        {onQuickAdd ? (
          <button
            type="button"
            onClick={() => onQuickAdd(food)}
            disabled={isQuickAdding}
            className="h-8 w-8 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 disabled:opacity-50"
            aria-label="Quick add"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
        <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
      </div>
    </div>
  )
}

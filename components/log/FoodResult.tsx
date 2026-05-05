import type { Food } from '../../types/index'
import { Loader2, Plus } from 'lucide-react'

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  ifct: { label: '🇮🇳 Indian', color: 'bg-orange-100 text-orange-600' },
  usda: { label: '🇺🇸 USDA', color: 'bg-blue-100 text-blue-600' },
  user: { label: '👤 Custom', color: 'bg-purple-100 text-purple-600' },
  off: { label: '🌍 Global', color: 'bg-gray-100 text-gray-500' },
  estimate: { label: '📊 Est.', color: 'bg-amber-100 text-amber-600' },
}

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
  const badge = SOURCE_BADGE[food.source] ?? SOURCE_BADGE.off

  return (
    <div className="flex w-full items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:border-orange-200 hover:shadow-md transition-all">
      <button
        type="button"
        className="flex-1 min-w-0 text-left"
        onClick={() => onSelect(food)}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate leading-tight">{food.name}</p>
            {food.brand && <p className="text-[11px] text-gray-400 truncate">{food.brand}</p>}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.color}`}>
            {badge.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="text-xs font-black text-gray-800">{Math.round(food.kcal_per_100g)} kcal</span>
          <span className="text-xs font-medium text-blue-600">P {Math.round(food.protein_g_per_100g)}g</span>
          <span className="text-xs font-medium text-amber-600">C {Math.round(food.carbs_g_per_100g)}g</span>
          <span className="text-xs font-medium text-rose-500">F {Math.round(food.fat_g_per_100g)}g</span>
          <span className="text-[10px] text-gray-400">per 100g</span>
        </div>
      </button>

      {onQuickAdd ? (
        <button
          type="button"
          onClick={() => onQuickAdd(food)}
          disabled={isQuickAdding}
          className="h-9 w-9 flex-shrink-0 rounded-2xl bg-orange-600 text-white flex items-center justify-center hover:bg-orange-700 active:scale-90 disabled:opacity-50 transition-all shadow-sm"
          aria-label="Quick add"
        >
          {isQuickAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </button>
      ) : null}
    </div>
  )
}

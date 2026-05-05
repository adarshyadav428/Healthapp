import type { Food } from '../../types/index'
import { ChevronRight } from 'lucide-react'

export function FoodResult({ food, onSelect }: { food: Food; onSelect: (food: Food) => void }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
      onClick={() => onSelect(food)}
    >
      <div className="flex-1 min-w-0 mr-2">
        <p className="text-sm font-semibold text-gray-900 truncate">{food.name}</p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-xs font-medium text-gray-700">{Math.round(food.kcal_per_100g)} kcal</span>
          <span className="text-xs text-blue-600">P {Math.round(food.protein_g_per_100g)}g</span>
          <span className="text-xs text-amber-600">C {Math.round(food.carbs_g_per_100g)}g</span>
          <span className="text-xs text-rose-500">F {Math.round(food.fat_g_per_100g)}g</span>
          <span className="text-xs text-gray-400">per 100g</span>
        </div>
        {food.brand && <p className="text-xs text-gray-400 mt-0.5">{food.brand}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
    </button>
  )
}

import type { Food } from '../../types/index'

export function FoodResult({ food, onSelect }: { food: Food; onSelect: (food: Food) => void }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 text-left hover:bg-gray-50"
      onClick={() => onSelect(food)}
    >
      <div>
        <p className="text-sm font-semibold text-gray-900">{food.name}</p>
        <p className="text-xs text-gray-500">{food.brand ?? 'Generic'}</p>
      </div>
      <div className="text-xs text-gray-500">{Math.round(food.kcal_per_100g)} kcal / 100g</div>
    </button>
  )
}

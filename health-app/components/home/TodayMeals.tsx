import type { FoodLog } from '../../types/index'
import { foodEmoji, tintFor } from '../../lib/foodVisual'
import { formatIst } from '../../lib/dateUtils'
import { isLiquidFood } from '../../lib/portion-units'

/**
 * Today's logged food on Home, grouped by meal — a list, not a stack of cards.
 *
 * Each meal is a typographic header (name, kcal) over hairline-separated rows;
 * the whole thing sits directly on the canvas so the calorie hero above stays
 * the only surface on the screen. Tapping a row opens the same edit modal the
 * old "Recently logged" cards did; nothing about the log is decided here.
 *
 * Meal order matches the diary (`components/log/TodayFoodLog.tsx`) so Home and
 * Food never list the same day two ways.
 */

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const

const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
}

// IST — the zone the log was filed under, never the device's (P2-4).
function formatTime(iso: string) {
  return formatIst(iso, { hour: 'numeric', minute: '2-digit', hour12: true })
}

function portionLabel(log: FoodLog, name: string): string {
  if (log.grams) return `${Math.round(log.grams)} ${isLiquidFood(name) ? 'ml' : 'g'}`
  return `${log.servings} ${log.servings === 1 ? 'serving' : 'servings'}`
}

export function groupByMeal(logs: FoodLog[]) {
  const groups: Record<string, FoodLog[]> = {}
  for (const log of logs) (groups[log.meal] ??= []).push(log)
  return MEAL_ORDER.filter((m) => groups[m]?.length).map((meal) => ({
    meal,
    label: MEAL_LABEL[meal] ?? meal,
    logs: groups[meal],
    kcal: Math.round(groups[meal].reduce((s, l) => s + l.kcal, 0)),
  }))
}

export function TodayMeals({ logs, onEdit }: { logs: FoodLog[]; onEdit: (log: FoodLog) => void }) {
  const groups = groupByMeal(logs)

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.meal} aria-label={g.label}>
          <div className="flex items-baseline justify-between px-1">
            <h3 className="font-sans text-caption font-semibold tracking-normal text-ink-2">{g.label}</h3>
            <p className="text-caption tabular-nums text-ink-3">{g.kcal.toLocaleString('en-IN')} kcal</p>
          </div>
          <ul className="mt-1 divide-y divide-hairline">
            {g.logs.map((log) => {
              const name = log.food?.name ?? 'Logged food'
              return (
                <li key={log.id}>
                  <button
                    type="button"
                    onClick={() => onEdit(log)}
                    aria-label={`Edit ${name}`}
                    className="flex w-full items-center gap-3.5 rounded-control px-1 py-3 text-left tap-scale hover:bg-surface-2"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-title-sm leading-none"
                      style={{ backgroundColor: `color-mix(in srgb, ${tintFor(name)} 12%, transparent)` }}
                    >
                      {foodEmoji(name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">{name}</span>
                      <span className="mt-0.5 block text-caption text-ink-3">
                        {portionLabel(log, name)} · {formatTime(log.logged_at)}
                      </span>
                    </span>
                    <span className="shrink-0 text-body font-semibold tabular-nums text-ink">
                      {Math.round(log.kcal)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

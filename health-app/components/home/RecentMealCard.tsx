import type { FoodLog } from '../../types/index'
import { foodEmoji, tintFor } from '../../lib/foodVisual'
import { formatIst } from '../../lib/dateUtils'

// Ember Air "Recently logged" card: a 64px food-emoji tile on a soft macro
// tint, name + "Meal · time" caption, and the kcal right-aligned.

const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

// IST — the zone the log was filed under. Rendered in the device's zone, a
// 1am snack read as an 8:30pm one the evening before (audit 2026-09-03, P2-4).
function formatTime(iso: string) {
  return formatIst(iso, { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function RecentMealCard({ log, imageUrl, onClick }: { log: FoodLog; imageUrl?: string | null; onClick?: () => void }) {
  const name = log.food?.name ?? 'Logged food'
  const mealLabel = MEAL_LABEL[log.meal] ?? log.meal
  const tint = tintFor(name)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-[20px] bg-surface p-3 text-left tap-scale"
      style={{ boxShadow: 'var(--shadow-air)' }}
    >
      {/* Thumbnail: photo when available, tinted emoji tile otherwise */}
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
        style={imageUrl ? undefined : { backgroundColor: `color-mix(in srgb, ${tint} 14%, transparent)` }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[28px] leading-none" aria-hidden="true">{foodEmoji(name)}</span>
        )}
      </div>

      {/* Name + caption */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold text-ink">{name}</p>
        <p className="mt-[3px] text-[12px] text-ink-3">{mealLabel} · {formatTime(log.logged_at)}</p>
      </div>

      {/* Kcal */}
      <div className="shrink-0 text-right">
        <p className="text-[15px] font-bold tabular-nums text-ink">{Math.round(log.kcal)}</p>
        <p className="mt-[1px] text-[10.5px] text-ink-3">kcal</p>
      </div>
    </button>
  )
}

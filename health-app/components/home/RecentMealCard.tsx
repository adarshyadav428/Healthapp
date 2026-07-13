import { Utensils } from 'lucide-react'
import type { FoodLog } from '../../types/index'

// Ember Air "Recently logged" card (2c variant): a 64px photo thumbnail with
// an icon-tile fallback, name + "Meal · time" caption, a small P/C/F row, and
// the kcal right-aligned. Photos light up automatically once meal-photo
// storage exists — until then every card renders the neutral utensils tile.

const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function RecentMealCard({ log, imageUrl }: { log: FoodLog; imageUrl?: string | null }) {
  const name = log.food?.name ?? 'Logged food'
  const mealLabel = MEAL_LABEL[log.meal] ?? log.meal

  return (
    <div className="flex items-center gap-3.5 rounded-[20px] bg-surface p-3" style={{ boxShadow: 'var(--shadow-air)' }}>
      {/* Thumbnail: photo when available, neutral icon tile otherwise */}
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px] bg-surface-2">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Utensils className="h-[22px] w-[22px] text-ink-3" strokeWidth={1.75} />
          </div>
        )}
      </div>

      {/* Name + caption + macro row */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold text-ink">{name}</p>
        <p className="mt-[3px] text-[12px] text-ink-3">{mealLabel} · {formatTime(log.logged_at)}</p>
        <div className="mt-1.5 flex gap-2.5">
          <span className="text-[10.5px] text-ink-3">P <b className="font-bold text-ink">{Math.round(log.protein_g)}</b></span>
          <span className="text-[10.5px] text-ink-3">C <b className="font-bold text-ink">{Math.round(log.carbs_g)}</b></span>
          <span className="text-[10.5px] text-ink-3">F <b className="font-bold text-ink">{Math.round(log.fat_g)}</b></span>
        </div>
      </div>

      {/* Kcal */}
      <div className="shrink-0 text-right">
        <p className="text-[15px] font-bold tabular-nums text-ink">{Math.round(log.kcal)}</p>
        <p className="mt-[1px] text-[10.5px] text-ink-3">kcal</p>
      </div>
    </div>
  )
}

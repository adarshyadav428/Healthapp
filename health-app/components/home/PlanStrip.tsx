import Link from 'next/link'
import { TrendingUp, ChevronRight } from 'lucide-react'

interface Props {
  calorieTarget: number
  maintenanceKcal?: number
  goal: 'lose' | 'maintain' | 'gain'
}

const GOAL_LABEL: Record<string, string> = {
  lose: 'Mild weight loss',
  maintain: 'Maintain weight',
  gain: 'Muscle gain',
}

export function PlanStrip({ calorieTarget, maintenanceKcal, goal }: Props) {
  return (
    <Link
      href="/settings"
      className="flex w-full items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-rest tap-scale"
    >
      <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-control bg-surface-2">
        <TrendingUp className="h-4 w-4 text-ink-2" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold leading-none text-ink">
          Plan · {GOAL_LABEL[goal] ?? 'Custom'}
        </p>
        <p className="mt-[3px] text-[11.5px] text-ink-3 tabular-nums">
          Target {calorieTarget.toLocaleString('en-IN')}
          {maintenanceKcal ? ` · Maintenance ${maintenanceKcal.toLocaleString('en-IN')}` : ''} kcal/day
        </p>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink-3" strokeWidth={1.75} />
    </Link>
  )
}

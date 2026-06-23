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
      className="flex items-center gap-3 w-full rounded-[18px] bg-white px-4 py-3 tap-scale"
      style={{ border: '1px solid #F1EFE9' }}
    >
      <div
        className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: '#F4F6F4' }}
      >
        <TrendingUp className="h-4 w-4 text-secondary" strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold text-ink leading-none">
          Plan · {GOAL_LABEL[goal] ?? 'Custom'}
        </p>
        <p className="text-[11.5px] font-medium text-muted mt-[3px]">
          Target {calorieTarget.toLocaleString('en-IN')}
          {maintenanceKcal ? ` · Maintenance ${maintenanceKcal.toLocaleString('en-IN')}` : ''} kcal/day
        </p>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: '#C4C0B6' }} />
    </Link>
  )
}

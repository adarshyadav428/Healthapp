'use client'

import { Progress } from '../ui/progress'
import type { DailyTotals, Profile } from '../../types/index'

export function MacroProgressBars({ totals, profile }: { totals: DailyTotals; profile: Profile }) {
  const proteinPct = profile.protein_g_target ? (totals.protein_g / profile.protein_g_target) * 100 : 0
  const carbsPct = profile.carbs_g_target ? (totals.carbs_g / profile.carbs_g_target) * 100 : 0
  const fatPct = profile.fat_g_target ? (totals.fat_g / profile.fat_g_target) * 100 : 0

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Protein</span>
          <span className="text-gray-500">
            {Math.round(totals.protein_g)}g / {profile.protein_g_target}g
          </span>
        </div>
        <Progress value={Math.min(100, proteinPct)} indicatorClassName="bg-blue-600" className="mt-2" />
      </div>
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Carbs</span>
          <span className="text-gray-500">
            {Math.round(totals.carbs_g)}g / {profile.carbs_g_target}g
          </span>
        </div>
        <Progress value={Math.min(100, carbsPct)} indicatorClassName="bg-yellow-500" className="mt-2" />
      </div>
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Fat</span>
          <span className="text-gray-500">
            {Math.round(totals.fat_g)}g / {profile.fat_g_target}g
          </span>
        </div>
        <Progress value={Math.min(100, fatPct)} indicatorClassName="bg-red-500" className="mt-2" />
      </div>
    </div>
  )
}

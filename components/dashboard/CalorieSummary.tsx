 'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Card } from '../ui/card'

export function CalorieSummary({ kcalEaten, kcalTarget }: { kcalEaten: number; kcalTarget: number }) {
  const ratio = kcalTarget > 0 ? kcalEaten / kcalTarget : 0
  const color = ratio < 0.8 ? '#22c55e' : ratio <= 1 ? '#eab308' : '#ef4444'

  const data = [
    { name: 'Eaten', value: kcalEaten },
    { name: 'Remaining', value: Math.max(kcalTarget - kcalEaten, 0) },
  ]

  return (
    <Card className="flex items-center justify-between gap-6">
      <div>
        <p className="text-sm text-gray-500">Today</p>
        <p className="text-4xl font-black text-gray-900">
          {kcalEaten.toLocaleString()} / {kcalTarget.toLocaleString()} kcal
        </p>
      </div>
      <div className="h-24 w-24">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={28} outerRadius={40} paddingAngle={2}>
              <Cell fill={color} />
              <Cell fill="#e5e7eb" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

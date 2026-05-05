'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { cn } from '../../lib/utils'

export function CalorieSummary({ kcalEaten, kcalTarget }: { kcalEaten: number; kcalTarget: number }) {
  const remaining = Math.max(kcalTarget - kcalEaten, 0)
  const over = kcalEaten > kcalTarget ? kcalEaten - kcalTarget : 0
  const ratio = kcalTarget > 0 ? Math.min(kcalEaten / kcalTarget, 1) : 0

  // green → yellow → red
  const ringColor =
    ratio < 0.8 ? '#22c55e' : ratio <= 1 ? '#f59e0b' : '#ef4444'

  const data = [
    { name: 'Eaten', value: kcalEaten },
    { name: 'Remaining', value: Math.max(kcalTarget - kcalEaten, 0) },
  ]

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between gap-4">
        {/* Left: text */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Today&apos;s calories</p>
          <p className="text-4xl font-black text-gray-900 leading-none">
            {kcalEaten.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">of {kcalTarget.toLocaleString()} goal</p>

          <div className="mt-3 flex gap-4">
            {over > 0 ? (
              <Stat label="Over goal" value={`+${over.toLocaleString()}`} color="text-red-500" />
            ) : (
              <Stat label="Remaining" value={remaining.toLocaleString()} color="text-green-600" />
            )}
          </div>
        </div>

        {/* Right: donut */}
        <div className="relative h-32 w-32 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={42}
                outerRadius={58}
                startAngle={90}
                endAngle={-270}
                paddingAngle={ratio < 1 ? 3 : 0}
                strokeWidth={0}
              >
                <Cell fill={ringColor} />
                <Cell fill="#f1f5f9" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className={cn('text-lg font-bold leading-none', over > 0 ? 'text-red-500' : 'text-gray-800')}>
              {over > 0 ? `+${over}` : remaining}
            </span>
            <span className="text-[10px] text-gray-400 mt-0.5">{over > 0 ? 'over' : 'left'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className={cn('text-base font-bold', color)}>{value} kcal</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  )
}

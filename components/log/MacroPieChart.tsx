'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

type Props = {
  protein: number
  carbs: number
  fat: number
}

const SLICES = [
  { key: 'protein', label: 'Protein', color: '#6366f1' },
  { key: 'carbs',   label: 'Carbs',   color: '#f59e0b' },
  { key: 'fat',     label: 'Fat',     color: '#f43f5e' },
] as const

export function MacroPieChart({ protein, carbs, fat }: Props) {
  const total = protein * 4 + carbs * 4 + fat * 9
  if (total <= 0) return null

  const data = [
    { name: 'Protein', value: Math.round(protein * 4), g: protein, color: '#6366f1' },
    { name: 'Carbs',   value: Math.round(carbs * 4),   g: carbs,   color: '#f59e0b' },
    { name: 'Fat',     value: Math.round(fat * 9),     g: fat,     color: '#f43f5e' },
  ].filter((d) => d.g > 0)

  return (
    <div className="flex items-center gap-4 mt-3">
      {/* Donut */}
      <div className="h-[72px] w-[72px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={22}
              outerRadius={34}
              dataKey="value"
              strokeWidth={0}
              startAngle={90}
              endAngle={-270}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload as typeof data[0]
                return (
                  <div className="rounded-xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 px-2.5 py-1.5 shadow text-xs">
                    <p style={{ color: d.color }} className="font-bold">{d.name}</p>
                    <p className="text-muted">{d.g}g · {d.value} kcal</p>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1 flex-1">
        {SLICES.map(({ key, label, color }) => {
          const g = key === 'protein' ? protein : key === 'carbs' ? carbs : fat
          const kcal = key === 'fat' ? g * 9 : g * 4
          const pct = total > 0 ? Math.round((kcal / total) * 100) : 0
          if (g <= 0) return null
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-[11px] text-muted flex-1">{label}</span>
              <span className="text-[11px] font-bold text-foreground">{Math.round(g)}g</span>
              <span className="text-[10px] text-muted w-8 text-right">{pct}%</span>
            </div>
          )
        })}
        <p className="text-[10px] text-muted mt-0.5">Total: {Math.round(total)} kcal from macros</p>
      </div>
    </div>
  )
}

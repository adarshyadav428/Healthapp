'use client'

import { useState } from 'react'
import type { WeightLog, Profile } from '../../types/index'
import { WeightStats } from './WeightStats'
import { WeightChart } from './WeightChart'
import { WeightLogModal } from './WeightLogModal'
import { useWeightLogs } from '../../hooks/useWeightLogs'
import { Button } from '../ui/button'

export function WeightClient({ logs, profile }: { logs: WeightLog[]; profile: Profile }) {
  const [open, setOpen] = useState(false)
  const { data = logs } = useWeightLogs(profile.id, logs)

  return (
    <div className="space-y-6">
      <WeightStats logs={data} profile={profile} />
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <WeightChart logs={data} />
      </div>
      <Button className="w-full" onClick={() => setOpen(true)}>Log Weight</Button>
      {open ? <WeightLogModal onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { QuickAddModal } from './QuickAddModal'
import { Zap } from 'lucide-react'

export function LogPageShell() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 flex w-full items-center gap-3 rounded-card border border-dashed border-brand-ring bg-surface px-4 py-3.5 text-left tap-scale transition-colors"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-control bg-brand-soft">
          <Zap className="h-4 w-4 text-brand" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-ink">Quick add</p>
          <p className="text-[12px] text-ink-3">Type a calorie count — done in 2 taps</p>
        </div>
      </button>

      {open && <QuickAddModal onClose={() => setOpen(false)} />}
    </>
  )
}

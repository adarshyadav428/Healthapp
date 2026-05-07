'use client'

import { useState } from 'react'
import { QuickAddModal } from './QuickAddModal'
import { Zap } from 'lucide-react'

export function LogPageShell() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Quick Add tile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[.99]"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-950/40">
          <Zap className="h-4 w-4 text-orange-500" />
        </span>
        <div>
          <p className="text-sm font-bold text-foreground">Quick Add</p>
          <p className="text-xs text-muted">Type a calorie count — done in 2 taps</p>
        </div>
      </button>

      {open && <QuickAddModal onClose={() => setOpen(false)} />}
    </>
  )
}

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
        className="mt-4 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left tap-scale transition-colors"
        style={{ background: '#FAFAF7', border: '1.5px dashed #FBDCCB' }}
      >
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: '#FFF0E7' }}
        >
          <Zap className="h-4 w-4" style={{ color: '#FB7445' }} />
        </span>
        <div>
          <p className="text-[14px] font-bold" style={{ color: '#16181D' }}>Quick Add</p>
          <p className="text-[12px]" style={{ color: '#9CA3AF' }}>Type a calorie count — done in 2 taps</p>
        </div>
      </button>

      {open && <QuickAddModal onClose={() => setOpen(false)} />}
    </>
  )
}

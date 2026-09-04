'use client'

import { Check } from 'lucide-react'
import { Button } from '../ui/button'
import { useScrollLock } from '../ui/use-scroll-lock'
import { useBackDismiss } from '../ui/use-back-dismiss'
import type { Unit } from '../../lib/portion-units'

/** Bottom-sheet measure picker shared by AddFoodModal and EditFoodLogModal. */
export function UnitPicker({
  foodName, units, selected, onSelect, onClose,
}: {
  foodName: string
  units: Unit[]
  selected: Unit
  onSelect: (u: Unit) => void
  onClose: () => void
}) {
  // Opens over AddFoodModal (nothing locked) and inside EditFoodLogModal's
  // Radix sheet (already locked) — the refcount and the Radix deferral in
  // useScrollLock are what let one component serve both.
  useScrollLock()
  useBackDismiss(true, onClose)

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-scrim backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-sheet bg-surface px-4 pb-6 pt-3 shadow-float">
        <div className="mx-auto h-1 w-10 rounded-full bg-hairline mb-4" />
        <p className="text-center text-xs uppercase tracking-wide font-bold text-ink-2 mb-2">{foodName}</p>
        <div className="space-y-1.5 mb-4">
          {units.map((u) => {
            const isActive = u.key === selected.key
            return (
              <button
                key={u.key}
                type="button"
                onClick={() => onSelect(u)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-card transition-all ${
                  isActive
                    ? 'bg-brand-soft text-brand-ink'
                    : 'hover:bg-surface-2 text-ink'
                }`}
              >
                <span className={`text-base ${isActive ? 'font-bold' : 'font-semibold'}`}>{u.label}</span>
                {isActive && <Check className="h-5 w-5" />}
              </button>
            )
          })}
        </div>
        <Button type="button" size="lg" variant="outline" onClick={onClose} className="w-full tap-scale">
          Done
        </Button>
      </div>
    </div>
  )
}

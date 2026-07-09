'use client'

import { useState } from 'react'
import { Scale, ChevronRight, Check, X } from 'lucide-react'
import { toast } from '../ui/use-toast'
import Link from 'next/link'

type Props = {
  currentWeightKg: number | null
  onLogged?: (kg: number) => void
}

export function WeightWidget({ currentWeightKg, onLogged }: Props) {
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState(currentWeightKg ? String(currentWeightKg) : '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const kg = parseFloat(val)
    if (isNaN(kg) || kg < 20 || kg > 500) {
      toast({ title: 'Enter a valid weight', variant: 'error', duration: 2000 })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/weight/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight_kg: kg }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      toast({ title: `Weight logged: ${kg} kg`, duration: 2500 })
      setOpen(false)
      onLogged?.(kg)
    } catch (err) {
      toast({ title: 'Could not log weight', description: (err as Error).message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-indigo-500" />
          <span className="text-xs font-semibold text-muted">Today&apos;s weight</span>
        </div>
        <div className="flex items-center gap-2">
          {currentWeightKg && (
            <span className="text-sm font-black tabular-nums text-foreground">{currentWeightKg} kg</span>
          )}
          <ChevronRight className={`h-3.5 w-3.5 text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-3 pt-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              min="20"
              max="500"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="e.g. 72.5"
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-400 transition-all"
              autoFocus
            />
            <span className="text-xs text-muted font-medium">kg</span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <span className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl px-2 py-2 text-muted hover:text-foreground hover:bg-gray-100 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <Link
            href="/weight"
            className="block text-[11px] font-semibold text-indigo-600 hover:underline"
          >
            View full weight history →
          </Link>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Search, ScanLine, Camera, Zap, Plus, Copy, ChevronLeft, Loader2 } from 'lucide-react'
import type { Food } from '../../types/index'
import { toast } from '../ui/use-toast'
import { foodEmoji, tintFor } from '../../lib/foodVisual'

// Modals + the full search are only opened on demand — defer their JS.
const FoodSearch    = dynamic(() => import('./FoodSearch').then(m => m.FoodSearch),        { ssr: false })
const CameraModal   = dynamic(() => import('../camera/CameraModal').then(m => m.CameraModal), { ssr: false })
const AddFoodModal  = dynamic(() => import('./AddFoodModal').then(m => m.AddFoodModal),     { ssr: false })
const QuickAddModal = dynamic(() => import('./QuickAddModal').then(m => m.QuickAddModal),   { ssr: false })

type RecentLogItem = { food: Food; grams: number; kcal: number; meal: string }

type Props = {
  recentFoods: Food[]
  recentLogItems: RecentLogItem[]
  frequentFoods: Food[]
  hasYesterdayLogs: boolean
}

const AIR = { boxShadow: 'var(--shadow-air)' } as const

function EmojiTile({ name }: { name: string }) {
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]"
      style={{ backgroundColor: `color-mix(in srgb, ${tintFor(name)} 14%, transparent)` }}
    >
      <span className="text-[22px] leading-none" aria-hidden="true">{foodEmoji(name)}</span>
    </div>
  )
}

function defaultMeal() {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

export function FoodLanding({ recentFoods, recentLogItems, frequentFoods, hasYesterdayLogs }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Home's "Add food manually" links here with ?search=1 to jump straight
  // into the search box instead of landing on this page first.
  const [searching, setSearching] = useState(searchParams.get('search') === '1')
  const [showCamera, setShowCamera] = useState(false)
  const [foundFood, setFoundFood] = useState<Food | null>(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [relogId, setRelogId] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const queryClient = useQueryClient()

  // Search mode: hand off to the full search experience.
  if (searching) {
    return (
      <div>
        <button
          type="button"
          onClick={() => { setSearching(false); router.replace('/log') }}
          className="mb-3 flex items-center gap-1 text-[13px] font-semibold text-brand-ink tap-scale"
        >
          <ChevronLeft className="h-4 w-4" /> Done
        </button>
        <FoodSearch
          recentFoods={recentFoods}
          recentLogItems={recentLogItems}
          frequentFoods={frequentFoods}
          hasYesterdayLogs={hasYesterdayLogs}
        />
      </div>
    )
  }

  const relog = async (item: RecentLogItem) => {
    if (relogId) return
    setRelogId(item.food.id)
    try {
      const res = await fetch('/api/logs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ food_id: item.food.id, meal: item.meal || defaultMeal(), servings: 1, grams: item.grams }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error((j as { error?: string }).error ?? 'Log failed') }
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      toast({ title: `Logged ${item.food.name}`, duration: 2000 })
    } catch (e) {
      toast({ title: 'Could not log', description: (e as Error).message, variant: 'error' })
    } finally {
      setRelogId(null)
    }
  }

  const copyYesterday = async () => {
    if (copying) return
    setCopying(true)
    try {
      const res = await fetch('/api/logs/copy-yesterday', { method: 'POST' })
      const j = (await res.json()) as { copied?: number; error?: string }
      if (!res.ok) throw new Error(j.error ?? 'Failed to copy')
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      toast({ title: `Copied ${j.copied} meal${(j.copied ?? 0) > 1 ? 's' : ''} from yesterday`, duration: 3000 })
    } catch (e) {
      toast({ title: 'Could not copy', description: (e as Error).message, variant: 'error' })
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Search pill */}
      <div className="flex items-center gap-3 rounded-full bg-surface px-[18px] py-[14px]" style={AIR}>
        <Search className="h-[17px] w-[17px] shrink-0 text-ink-3" strokeWidth={2} />
        <button type="button" onClick={() => setSearching(true)} className="flex-1 truncate text-left text-[14.5px] text-ink-3">
          Search dal makhani, roti, paratha…
        </button>
        <button type="button" onClick={() => setShowCamera(true)} aria-label="Scan barcode" className="shrink-0 tap-scale">
          <ScanLine className="h-[18px] w-[18px] text-ink" strokeWidth={2} />
        </button>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setShowCamera(true)}
          className="flex flex-col gap-5 rounded-[20px] bg-cta-grad p-[18px] text-left tap-scale"
          style={{ boxShadow: 'var(--cta-shadow)' }}
        >
          <Camera className="h-5 w-5 text-white" strokeWidth={2} />
          <div>
            <p className="text-[14.5px] font-semibold text-white">Scan meal</p>
            <p className="mt-0.5 text-[11.5px]" style={{ color: 'rgba(255,255,255,.72)' }}>Point &amp; log</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setShowQuickAdd(true)}
          className="flex flex-col gap-5 rounded-[20px] bg-surface p-[18px] text-left tap-scale"
          style={AIR}
        >
          <Zap className="h-5 w-5 text-ink" strokeWidth={2} />
          <div>
            <p className="text-[14.5px] font-semibold text-ink">Quick add</p>
            <p className="mt-0.5 text-[11.5px] text-ink-3">Just calories</p>
          </div>
        </button>
      </div>

      {/* Log again */}
      {recentLogItems.length > 0 && (
        <div className="pt-2">
          <div className="mb-2.5 flex items-baseline justify-between px-0.5">
            <p className="text-[16px] font-semibold text-ink">Log again</p>
            <Link href="/progress" className="text-[13px] font-semibold text-brand-ink tap-scale">History</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {recentLogItems.map((item) => (
              <div key={item.food.id} className="flex items-center gap-3.5 rounded-[20px] bg-surface p-3" style={AIR}>
                <EmojiTile name={item.food.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-ink">{item.food.name}</p>
                  <p className="mt-[3px] text-[12px] text-ink-3">{Math.round(item.grams)}g · {Math.round(item.kcal)} kcal</p>
                </div>
                <button
                  type="button"
                  onClick={() => relog(item)}
                  disabled={!!relogId}
                  aria-label={`Log ${item.food.name} again`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cta-grad tap-scale disabled:opacity-50"
                  style={{ boxShadow: 'var(--fab-shadow)' }}
                >
                  {relogId === item.food.id
                    ? <Loader2 className="h-4 w-4 animate-spin text-white" />
                    : <Plus className="h-[18px] w-[18px] text-white" strokeWidth={2.2} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Copy yesterday */}
      {hasYesterdayLogs && (
        <button
          type="button"
          onClick={copyYesterday}
          disabled={copying}
          className="flex w-full items-center gap-3 rounded-[20px] bg-surface p-4 text-left tap-scale disabled:opacity-50"
          style={AIR}
        >
          <Copy className="h-[18px] w-[18px] shrink-0 text-brand" strokeWidth={2} />
          <span className="text-[14px] font-semibold text-ink">{copying ? 'Copying…' : "Copy yesterday's meals"}</span>
        </button>
      )}

      {showCamera && (
        <CameraModal onClose={() => setShowCamera(false)} onFoodFound={(food) => { setShowCamera(false); setFoundFood(food) }} />
      )}
      {foundFood && <AddFoodModal food={foundFood} onClose={() => setFoundFood(null)} />}
      {showQuickAdd && <QuickAddModal onClose={() => setShowQuickAdd(false)} />}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, ScanLine, Camera, Zap, Plus, ChevronLeft, Sparkles, X } from 'lucide-react'
import type { Food } from '../../types/index'
import { toast } from '../ui/use-toast'
import { reportLogMilestone } from '../../store/milestoneStore'
import type { LogMilestone } from '../../lib/logMilestones'
import { mealForTime } from '../../lib/meal'
import { defaultPortionFor, isLiquidFood } from '../../lib/portion-units'
import { captureEvent, logMetaHeaders, markLogStart } from '../../lib/posthog/client'
import { EVENTS } from '../../lib/posthog/events'
import { useUser } from '../../hooks/useUser'
import { useFoodFavourites } from '../../hooks/useFoodFavourites'
import {
  ComboTile, CopyYesterdayButton, EmojiTile, ShortcutHeading, ShortcutRow,
} from './shortcuts'
import { ProLock } from '../ui/ProLock'

// Modals + the full search are only opened on demand — defer their JS.
const FoodSearch    = dynamic(() => import('./FoodSearch').then(m => m.FoodSearch),        { ssr: false })
const CameraModal   = dynamic(() => import('../camera/CameraModal').then(m => m.CameraModal), { ssr: false })
const AddFoodModal  = dynamic(() => import('./AddFoodModal').then(m => m.AddFoodModal),     { ssr: false })
const QuickAddModal = dynamic(() => import('./QuickAddModal').then(m => m.QuickAddModal),   { ssr: false })

type RecentLogItem = { food: Food; grams: number; kcal: number; meal: string }

/** One row from /api/foods/suggest — the fields this surface renders. */
type Suggestion = { food: Food; grams: number; kcal: number }

type SavedMealSummary = {
  id: string
  name: string
  saved_meal_items: { food_id: string; grams: number; servings: number; food: { kcal_per_100g: number } | null }[]
}

/** Total kcal of a saved template, so the combo chip can show what it costs. */
function savedMealKcal(meal: SavedMealSummary): number {
  return Math.round(
    (meal.saved_meal_items ?? []).reduce((sum, item) => {
      if (!item.food) return sum
      return sum + (item.food.kcal_per_100g * item.grams * (item.servings ?? 1)) / 100
    }, 0)
  )
}

type Props = {
  recentFoods: Food[]
  recentLogItems: RecentLogItem[]
  frequentFoods: Food[]
  hasYesterdayLogs: boolean
  /** The IST day being viewed (YYYY-MM-DD). Logs target this day (backfill). */
  logDate?: string
  /** Whether the viewed day is today — gates today-only surfaces (copy-yesterday). */
  isToday?: boolean
  /** Pro entitlement — threaded through to search's custom-food gate and the
   *  suggestion row's free daily cap. */
  isPro?: boolean
}

const AIR = { boxShadow: 'var(--shadow-air)' } as const

export function FoodLanding({ recentFoods, recentLogItems, frequentFoods, hasYesterdayLogs, logDate, isToday = true, isPro = true }: Props) {
  const searchParams = useSearchParams()
  // Home's "Add food manually" links here with ?search=1 to jump straight
  // into the search box instead of landing on this page first.
  const [searching, setSearching] = useState(searchParams.get('search') === '1')
  const [showCamera, setShowCamera] = useState(false)
  const [foundFood, setFoundFood] = useState<Food | null>(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [suggestIndex, setSuggestIndex] = useState(0)
  const [relogId, setRelogId] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const [loggingMealId, setLoggingMealId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { user } = useUser()
  // Favourites are the only shortcut the user curates by hand, and they used
  // to be visible on exactly one screen — inside search mode, with the box
  // empty. Anyone who starred a dish had to search their way back to it.
  const { favouriteFoods } = useFoodFavourites(user?.id ?? null)

  // The meal slot this time of day belongs to — drives both which saved
  // templates surface first and which past items lead "Log again".
  const currentMeal = mealForTime()

  // One suggested dish that fits the calories left. Only fetched on today —
  // the row doesn't render on a past day, so neither should the request.
  const { data: suggestData } = useQuery({
    queryKey: ['meal-suggestions-landing'],
    enabled: isToday,
    queryFn: async () => {
      const res = await fetch('/api/foods/suggest')
      if (!res.ok) return { suggestions: [] as Suggestion[], limited: false }
      return res.json() as Promise<{ suggestions: Suggestion[]; limited?: boolean }>
    },
  })
  const suggestion = suggestData?.suggestions?.[suggestIndex] ?? null
  // The server caps free users at FREE_SUGGESTIONS_PER_DAY and returns `limited`
  // so the run-out reads as a gate, not a bug. Once the day's suggestions are
  // spent, a free user sees the lock rather than the row silently vanishing.
  const suggestionsSpent =
    isToday && !isPro && !!suggestData?.limited && !suggestion && (suggestData?.suggestions?.length ?? 0) > 0

  // Saved meal templates: the genuine two-tap path (open Food -> tap combo).
  const { data: savedMeals = [] } = useQuery({
    queryKey: ['saved-meals-landing'],
    queryFn: async () => {
      const res = await fetch('/api/meals/saved')
      if (!res.ok) return []
      return res.json() as Promise<SavedMealSummary[]>
    },
  })

  const logSavedMeal = async (meal: SavedMealSummary) => {
    if (loggingMealId) return
    markLogStart()
    setLoggingMealId(meal.id)
    try {
      const res = await fetch('/api/meals/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...logMetaHeaders('meal_template') },
        body: JSON.stringify({ meal_id: meal.id, meal_type: currentMeal }),
      })
      const j = (await res.json().catch(() => ({}))) as { logged?: number; error?: string }
      if (!res.ok) throw new Error(j.error ?? 'Could not log meal')
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      toast({ title: `Logged ${meal.name}`, description: `${j.logged} items → ${currentMeal}.`, duration: 2500 })
    } catch (e) {
      toast({ title: 'Could not log meal', description: (e as Error).message, variant: 'error' })
    } finally {
      setLoggingMealId(null)
    }
  }

  // Items logged to this slot before lead the list — at 8am you want yesterday's
  // breakfast, not last night's dinner. Everything else still follows, so
  // nothing becomes unreachable; only the order changes.
  const orderedRecentItems = useMemo(() => {
    const forSlot = recentLogItems.filter((i) => i.meal === currentMeal)
    const rest = recentLogItems.filter((i) => i.meal !== currentMeal)
    return [...forSlot.slice(0, 3), ...forSlot.slice(3), ...rest]
  }, [recentLogItems, currentMeal])

  // Leaving search only needs the `?search=1` deep-link param gone. router
  // .replace('/log') did that by re-running a force-dynamic page — six
  // Supabase queries to close a text box. Strip it in place instead, the same
  // way BottomNav clears `?scan=1`.
  const closeSearch = () => {
    setSearching(false)
    const url = new URL(window.location.href)
    if (!url.searchParams.has('search')) return
    url.searchParams.delete('search')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }

  // Search mode: hand off to the full search experience.
  if (searching) {
    return (
      <div>
        <button
          type="button"
          onClick={closeSearch}
          className="mb-3 flex items-center gap-1 text-[13px] font-semibold text-brand-ink tap-scale"
        >
          <ChevronLeft className="h-4 w-4" /> Done
        </button>
        <FoodSearch
          recentFoods={recentFoods}
          recentLogItems={recentLogItems}
          frequentFoods={frequentFoods}
          hasYesterdayLogs={hasYesterdayLogs}
          logDate={logDate}
          isToday={isToday}
          isPro={isPro}
        />
      </div>
    )
  }

  const relog = async (item: RecentLogItem) => {
    if (relogId) return
    markLogStart()
    setRelogId(item.food.id)
    try {
      const res = await fetch('/api/logs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...logMetaHeaders('log_again') },
        body: JSON.stringify({ food_id: item.food.id, meal: item.meal || mealForTime(), servings: 1, grams: item.grams, date: logDate }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string; milestone?: LogMilestone }
      if (!res.ok) throw new Error(j.error ?? 'Log failed')
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      toast({ title: `Logged ${item.food.name}`, duration: 2000 })
      reportLogMilestone(j.milestone)
    } catch (e) {
      toast({ title: 'Could not log', description: (e as Error).message, variant: 'error' })
    } finally {
      setRelogId(null)
    }
  }

  // "Not this" is the deck's left-swipe: it persists to food_dismissals so the
  // same dish stops coming back, then shows the next candidate. Fire-and-forget
  // — a failed dismissal costs one repeated suggestion, not a blocked UI.
  const dismissSuggestion = () => {
    const current = suggestion
    if (!current) return
    captureEvent(EVENTS.MEAL_SUGGESTION_SWIPED, {
      direction: 'left',
      source: current.food.source,
      kcal: current.kcal,
    })
    fetch('/api/foods/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodId: current.food.id }),
    }).catch(() => {})
    setSuggestIndex((i) => i + 1)
  }

  // A starred food has no past-log grams to reuse, so it takes the same
  // default portion the search row's "+" and AddFoodModal both use.
  const quickAddFavourite = async (food: Food) => {
    if (relogId) return
    markLogStart()
    setRelogId(food.id)
    try {
      const res = await fetch('/api/logs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...logMetaHeaders('log_again') },
        body: JSON.stringify({
          food_id: food.id,
          meal: currentMeal,
          servings: 1,
          grams: defaultPortionFor(food).grams,
          date: logDate,
        }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string; milestone?: LogMilestone }
      if (!res.ok) throw new Error(j.error ?? 'Log failed')
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      toast({ title: `Logged ${food.name}`, duration: 2000 })
      reportLogMilestone(j.milestone)
    } catch (e) {
      toast({ title: 'Could not log', description: (e as Error).message, variant: 'error' })
    } finally {
      setRelogId(null)
    }
  }

  const copyYesterday = async () => {
    if (copying) return
    markLogStart()
    setCopying(true)
    try {
      const res = await fetch('/api/logs/copy-yesterday', { method: 'POST', headers: logMetaHeaders('copy_yesterday') })
      const j = (await res.json()) as { copied?: number; error?: string; milestone?: LogMilestone }
      if (!res.ok) throw new Error(j.error ?? 'Failed to copy')
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      toast({ title: `Copied ${j.copied} meal${(j.copied ?? 0) > 1 ? 's' : ''} from yesterday`, duration: 3000 })
      reportLogMilestone(j.milestone)
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

      {/* "What should I eat?" — one suggested dish inline, not a full-screen
          deck. The deck was a whole surface (and its own swipe grammar) for a
          decision that is really "log this, or show me another". Only on today:
          suggesting dinner for a day that's already over is nonsense. */}
      {isToday && suggestion && (
        <div className="flex items-center gap-3.5 rounded-[20px] bg-surface p-3" style={AIR}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
            <Sparkles className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-semibold text-ink">{suggestion.food.name}</p>
            <p className="mt-[3px] text-[12px] text-ink-3">
              {Math.round(suggestion.grams)}{isLiquidFood(suggestion.food.name) ? 'ml' : 'g'} · {Math.round(suggestion.kcal)} kcal · fits what&apos;s left
            </p>
          </div>
          <button
            type="button"
            onClick={dismissSuggestion}
            aria-label="Suggest something else"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-3 tap-scale"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => setFoundFood(suggestion.food)}
            aria-label={`Log ${suggestion.food.name}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cta-grad tap-scale"
            style={{ boxShadow: 'var(--fab-shadow)' }}
          >
            <Plus className="h-[18px] w-[18px] text-white" strokeWidth={2.2} />
          </button>
        </div>
      )}

      {suggestionsSpent && (
        <ProLock.Card
          reason="meal_suggestions"
          track="meal_suggestions"
          title="That's today's meal ideas"
          body="Free gives you three suggestions a day. Pro keeps them coming — right through the evening, always tuned to the calories you have left."
          cta="See what Pro adds"
        />
      )}

      {/* Your combos — saved templates, the fastest path to a full meal */}
      {savedMeals.length > 0 && (
        <div className="pt-2">
          <ShortcutHeading title="Your combos" hint={`one tap → ${currentMeal}`} />
          <div className="flex flex-col gap-2.5">
            {savedMeals.map((meal) => (
              <ShortcutRow
                key={meal.id}
                name={meal.name}
                detail={`${meal.saved_meal_items?.length ?? 0} items · ${savedMealKcal(meal)} kcal`}
                tile={<ComboTile />}
                busy={loggingMealId === meal.id}
                disabled={!!loggingMealId}
                actionLabel={`Log ${meal.name}`}
                onAdd={() => logSavedMeal(meal)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Favourites — curated by hand, so they lead the re-log surfaces */}
      {favouriteFoods.length > 0 && (
        <div className="pt-2">
          <ShortcutHeading title="Favourites" hint={`one tap → ${currentMeal}`} />
          <div className="flex flex-col gap-2.5">
            {favouriteFoods.map((food) => (
              <ShortcutRow
                key={food.id}
                name={food.name}
                detail={`${Math.round(defaultPortionFor(food).grams)}${isLiquidFood(food.name) ? 'ml' : 'g'}`}
                tile={<EmojiTile name={food.name} />}
                busy={relogId === food.id}
                disabled={!!relogId}
                actionLabel={`Log ${food.name}`}
                onAdd={() => quickAddFavourite(food)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Log again */}
      {orderedRecentItems.length > 0 && (
        <div className="pt-2">
          <div className="mb-2.5 flex items-baseline justify-between px-0.5">
            <p className="text-[16px] font-semibold text-ink">Log again</p>
            <Link href="/progress" className="text-[13px] font-semibold text-brand-ink tap-scale">History</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {orderedRecentItems.map((item) => (
              <ShortcutRow
                key={item.food.id}
                name={item.food.name}
                detail={`${Math.round(item.grams)}${isLiquidFood(item.food.name) ? 'ml' : 'g'} · ${Math.round(item.kcal)} kcal`}
                tile={<EmojiTile name={item.food.name} />}
                busy={relogId === item.food.id}
                disabled={!!relogId}
                actionLabel={`Log ${item.food.name} again`}
                onAdd={() => relog(item)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Copy yesterday — only meaningful on today's view (it copies into today) */}
      {isToday && hasYesterdayLogs && (
        <CopyYesterdayButton copying={copying} onClick={copyYesterday} />
      )}

      {showCamera && (
        <CameraModal logDate={logDate} onClose={() => setShowCamera(false)} onFoodFound={(food) => { setShowCamera(false); setFoundFood(food) }} />
      )}
      {foundFood && <AddFoodModal food={foundFood} onClose={() => setFoundFood(null)} logDate={logDate} />}
      {showQuickAdd && <QuickAddModal onClose={() => setShowQuickAdd(false)} logDate={logDate} />}
    </div>
  )
}

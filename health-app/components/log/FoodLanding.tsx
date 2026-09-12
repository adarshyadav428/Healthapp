'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, X } from 'lucide-react'
import type { Food } from '../../types/index'
import type { LastPortion } from '../../lib/lastPortions'
import { isLiquidFood } from '../../lib/portion-units'
import { captureEvent } from '../../lib/posthog/client'
import { EVENTS } from '../../lib/posthog/events'
import { FoodSearch } from './FoodSearch'
import { AddButton, BRAND_TILE, ShortcutHeading } from './shortcuts'
import { ProLock } from '../ui/ProLock'

// The portion sheet is only opened on demand — defer its JS.
const AddFoodModal = dynamic(() => import('./AddFoodModal').then(m => m.AddFoodModal), { ssr: false })

type RecentLogItem = { food: Food; grams: number; kcal: number; meal: string }

/** One row from /api/foods/suggest — the fields this surface renders. */
type Suggestion = { food: Food; grams: number; kcal: number }

type Props = {
  recentFoods: Food[]
  recentLogItems: RecentLogItem[]
  frequentFoods: Food[]
  hasYesterdayLogs: boolean
  /** The IST day being viewed (YYYY-MM-DD). Logs target this day (backfill). */
  logDate?: string
  /** Whether the viewed day is today — gates today-only surfaces (copy-yesterday, the suggestion). */
  isToday?: boolean
  /** Pro entitlement — threaded through to search's custom-food gate and the
   *  suggestion row's free daily cap. */
  isPro?: boolean
  /** Free AI scans left — threaded to search's chat button so a spent user
   *  hits the paywall on tap, not after typing a meal. */
  aiTrialRemaining?: number
  /** The day's calorie + protein targets, forwarded to AddFoodModal so a log
   *  answers with a coaching sentence instead of just a number (P1-13). */
  targets?: { kcal: number; protein: number }
  /** How each food was last logged — what "+" re-logs. See lib/lastPortions. */
  lastPortions?: Record<string, LastPortion>
}

/**
 * The logging half of the Food screen. `FoodSearch` owns the field, the
 * shelves and the results; this shell owns the two things that are about the
 * page rather than the search: the Home deep link's autofocus, and the day's
 * one suggested dish.
 */
export function FoodLanding({ recentFoods, recentLogItems, frequentFoods, hasYesterdayLogs, logDate, isToday = true, isPro = true, aiTrialRemaining = 0, targets, lastPortions }: Props) {
  const searchParams = useSearchParams()
  // Home's search pill links here with ?search=1 so one tap lands the cursor
  // in the real box. Read once: the param is stripped below, and the focus
  // must not come back on a refresh or a Back.
  const [autoFocus] = useState(searchParams.get('search') === '1')
  const [foundFood, setFoundFood] = useState<Food | null>(null)
  const [suggestIndex, setSuggestIndex] = useState(0)

  // Strip the deep-link param in place. router.replace('/log') would re-run a
  // force-dynamic page — six Supabase queries to tidy a URL — so this does what
  // BottomNav does with `?scan=1`.
  useEffect(() => {
    if (!autoFocus) return
    const url = new URL(window.location.href)
    if (!url.searchParams.has('search')) return
    url.searchParams.delete('search')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [autoFocus])

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

  // "What should I eat?" — one suggested dish as a row, not a full-screen
  // deck. Only on today: suggesting dinner for a day that's over is nonsense.
  const suggestionRow = isToday && (suggestion || suggestionsSpent) ? (
    <div className="mt-2 border-t border-hairline pt-1">
      <ShortcutHeading title="Fits what's left" />
      {suggestion && (
        <div className="flex items-center gap-3 py-2.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control text-brand" style={BRAND_TILE}>
            <Sparkles className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-medium text-ink">{suggestion.food.name}</p>
            <p className="mt-0.5 text-caption text-ink-3">
              {Math.round(suggestion.grams)} {isLiquidFood(suggestion.food.name) ? 'ml' : 'g'} · {Math.round(suggestion.kcal)} kcal
            </p>
          </div>
          <button
            type="button"
            onClick={dismissSuggestion}
            aria-label="Suggest something else"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-3 tap-scale hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <AddButton
            busy={false}
            disabled={false}
            label={`Log ${suggestion.food.name}`}
            onClick={() => setFoundFood(suggestion.food)}
          />
        </div>
      )}
      {suggestionsSpent && (
        <div className="py-2">
          <ProLock.Card
            reason="meal_suggestions"
            track="meal_suggestions"
            title="That's your free ideas for now"
            body="Free shows a few ideas at a time. Pro keeps them coming — right through the evening, always tuned to the calories you have left."
            cta="See what Pro adds"
          />
        </div>
      )}
    </div>
  ) : null

  return (
    <>
      <FoodSearch
        recentFoods={recentFoods}
        recentLogItems={recentLogItems}
        frequentFoods={frequentFoods}
        hasYesterdayLogs={hasYesterdayLogs}
        logDate={logDate}
        isToday={isToday}
        isPro={isPro}
        aiTrialRemaining={aiTrialRemaining}
        targets={targets}
        lastPortions={lastPortions}
        autoFocus={autoFocus}
        idleExtras={suggestionRow}
      />
      {foundFood && <AddFoodModal food={foundFood} onClose={() => setFoundFood(null)} logDate={logDate} targets={targets} />}
    </>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { Food } from '../../types/index'
import { FoodResult } from './FoodResult'
import { MessageCircle, PlusCircle, ScanLine, Zap } from 'lucide-react'
import { useFoodSearch, type RecentLogItem } from '../../hooks/useFoodSearch'
import { markLogStart } from '../../lib/posthog/client'
import { mealForTime } from '../../lib/meal'
import type { LastPortion } from '../../lib/lastPortions'
import { SearchField } from '../ui/search-field'
import { SegmentedControl } from '../ui/segmented-control'
import { Button } from '../ui/button'
import {
  ComboTile, CopyYesterdayButton, ShortcutHeading, ShortcutRow,
} from './shortcuts'

// Modals are only opened on user action — defer their JS until then.
const AddFoodModal    = dynamic(() => import('./AddFoodModal').then(m => m.AddFoodModal),       { ssr: false })
const CreateFoodModal = dynamic(() => import('./CreateFoodModal').then(m => m.CreateFoodModal), { ssr: false })
const QuickAddModal   = dynamic(() => import('./QuickAddModal').then(m => m.QuickAddModal),     { ssr: false })
const CameraModal     = dynamic(() => import('../camera/CameraModal').then(m => m.CameraModal), { ssr: false })
const ChatLogModal    = dynamic(() => import('../chat/ChatLogModal').then(m => m.ChatLogModal),  { ssr: false })

type Tab = 'recent' | 'favourites' | 'mine'

const TABS: { value: Tab; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'favourites', label: 'Favourites' },
  { value: 'mine', label: 'My foods' },
]

type Props = {
  recentFoods: Food[]
  recentLogItems?: RecentLogItem[]
  frequentFoods: Food[]
  hasYesterdayLogs: boolean
  /** The IST day being viewed (YYYY-MM-DD). Logs target this day (backfill). */
  logDate?: string
  /** Whether the viewed day is today — gates today-only surfaces. */
  isToday?: boolean
  /** Pro entitlement — drives whether "create custom food" opens a form or a lock. */
  isPro?: boolean
  /** Free AI scans left. A spent free user's chat tap goes to the paywall
   *  rather than opening a modal they'd fill out and be ejected from — the same
   *  pre-emptive gate the dashboard chat bubble uses. */
  aiTrialRemaining?: number
  /** The day's calorie + protein targets, forwarded to AddFoodModal so a log
   *  answers with a coaching sentence instead of just a number (P1-13). */
  targets?: { kcal: number; protein: number }
  /** How each food was last logged — decides what "+" does. See lib/lastPortions. */
  lastPortions?: Record<string, LastPortion>
  /** Focus the field on mount — set when Home's search pill deep-links here. */
  autoFocus?: boolean
  /** Rendered under the Recent tab, after the rows (the day's suggestion). */
  idleExtras?: ReactNode
}

export function FoodSearch({
  recentFoods, recentLogItems = [], frequentFoods, hasYesterdayLogs, logDate, isToday = true,
  isPro = true, aiTrialRemaining = 0, targets, lastPortions = {}, autoFocus = false, idleExtras,
}: Props) {
  const router = useRouter()
  const canUseAi = isPro || aiTrialRemaining > 0
  const inputRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>('recent')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  // Start the clock for `seconds_to_log`: this surface opening is the moment
  // the user set out to log something. See markLogStart in lib/posthog/client.
  useEffect(() => { markLogStart() }, [])
  // Programmatic focus after a navigation, for the Home → Food deep link. The
  // `autoFocus` attribute alone is unreliable once the page is client-routed.
  useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])

  const {
    query, setQuery, debounced, isSearching, data, isLoading, error,
    defaultMeal,
    savedMeals, loggingMealId, deletingSavedMealId, logSavedMeal, deleteSavedMeal,
    copying, copyYesterday, quickAddingId, quickAdd,
    favouriteFoods, favouriteIds, toggleFavourite,
    selected, setSelected, showCamera, setShowCamera, showChat, setShowChat,
    showCreateFood, setShowCreateFood,
  } = useFoodSearch({ recentFoods, recentLogItems, frequentFoods, logDate })

  // The portion a food went in at last time. The server map covers 200 logs;
  // the "Log again" items are the same data for the five most recent foods,
  // so they fill in when the map is absent (older callers, tests).
  const lastPortionFor = (food: Food): LastPortion | undefined => {
    const fromMap = lastPortions[food.id]
    if (fromMap) return fromMap
    const item = recentLogItems.find((i) => i.food.id === food.id)
    return item ? { grams: item.grams, kcal: item.kcal, meal: item.meal } : undefined
  }

  // The one "+" rule, everywhere on this screen: a food logged before goes
  // straight in at last time's portion; a food never logged opens the portion
  // sheet so the first amount is a chosen one. Recent and frequent foods are
  // previously-logged by definition, so they always go straight in.
  const addFromList = (food: Food, method: 'search' | 'log_again', knownLogged = false) => {
    const last = lastPortionFor(food)
    if (last) return quickAdd(food, method, last.grams)
    if (knownLogged) return quickAdd(food, method)
    setSelected(food)
  }

  // Items logged to this slot before lead the list — at 8am you want
  // yesterday's breakfast, not last night's dinner. Everything else follows.
  const currentMeal = mealForTime()
  const orderedRecent = useMemo(() => {
    const forSlot = recentFoods.filter((f) => lastPortions[f.id]?.meal === currentMeal
      || recentLogItems.some((i) => i.food.id === f.id && i.meal === currentMeal))
    const rest = recentFoods.filter((f) => !forSlot.includes(f))
    return [...forSlot, ...rest]
  }, [recentFoods, recentLogItems, lastPortions, currentMeal])

  // A short shelf, not a catalogue: five recent, three often. The catalogue
  // holds the same dish under more than one id ("Roti / Chapati (Wheat)" from
  // two sources), so "Often" also skips anything whose name is already showing.
  const RECENT_MAX = 5
  const OFTEN_MAX = 3
  const shownRecent = orderedRecent.slice(0, RECENT_MAX)
  const shownNames = useMemo(
    () => new Set(shownRecent.map((f) => f.name.trim().toLowerCase())),
    [shownRecent]
  )
  const oftenFoods = frequentFoods
    .filter((f) => !shownNames.has(f.name.trim().toLowerCase()))
    .filter((f, i, arr) => arr.findIndex((g) => g.name.trim().toLowerCase() === f.name.trim().toLowerCase()) === i)
    .slice(0, OFTEN_MAX)

  const results = data ?? []

  return (
    <div>
      {/* ── Search: the one control this screen is for ── */}
      <SearchField
        ref={inputRef}
        placeholder="Search dal makhani, roti…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => { setQuery(''); inputRef.current?.focus() }}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        autoFocus={autoFocus}
        actionCount={2}
        actions={
          <>
            <button
              type="button"
              onClick={() => canUseAi ? setShowChat(true) : router.push('/upgrade?reason=chat_scan_pro')}
              className="grid h-11 w-11 place-items-center rounded-full text-brand tap-scale hover:bg-surface-2"
              aria-label={canUseAi ? 'Log meal with AI chat' : 'AI meal logging — a Pro feature'}
            >
              <MessageCircle className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="grid h-11 w-11 place-items-center rounded-full text-ink-2 tap-scale hover:bg-surface-2 hover:text-ink"
              aria-label="Scan barcode or take photo"
            >
              <ScanLine className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </>
        }
      />

      {/* ── Results replace the shelves while a query is live ── */}
      {isSearching ? (
        <div className="mt-2" aria-live="polite">
          {isLoading ? (
            <ul className="divide-y divide-hairline">
              {[1, 2, 3].map((i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <div className="h-11 w-11 rounded-control bg-surface-2 animate-shimmer" />
                  <div className="flex-1">
                    <div className="h-4 w-2/5 rounded-full bg-surface-2 animate-shimmer" />
                    <div className="mt-2 h-3 w-1/4 rounded-full bg-surface-2 animate-shimmer" />
                  </div>
                </li>
              ))}
            </ul>
          ) : error ? (
            <p className="px-1 py-6 text-body text-danger">{(error as Error).message}</p>
          ) : results.length === 0 ? (
            <div className="px-1 py-10 text-center">
              <p className="text-body font-medium text-ink">Nothing called &ldquo;{debounced}&rdquo;</p>
              <p className="mt-1 text-caption text-ink-3">Try another spelling, or add it yourself.</p>
              <div className="mt-5 flex flex-col items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateFood(true)}>
                  <PlusCircle className="h-5 w-5" strokeWidth={1.75} />
                  Create &ldquo;{debounced}&rdquo;
                </Button>
                <Button type="button" variant="subtle" onClick={() => setShowQuickAdd(true)}>
                  <Zap className="h-5 w-5" strokeWidth={1.75} />
                  Quick add calories
                </Button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {results.map((food) => (
                <li key={food.id}>
                  <FoodResult
                    food={food}
                    onSelect={setSelected}
                    onQuickAdd={(f) => addFromList(f, 'search')}
                    isQuickAdding={quickAddingId === food.id}
                    isFavourite={favouriteIds.has(food.id)}
                    onToggleFavourite={toggleFavourite}
                    lastPortion={lastPortionFor(food)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        // Outlined, not filled: the shelves are a frame around things you
        // might log; the day's log below is the filled surface.
        <div className="mt-4 rounded-card-lg border-2 border-hairline-2 px-4 pb-3 pt-4">
          <SegmentedControl aria-label="Food shelves" options={TABS} value={tab} onChange={setTab} />

          {/* ── Recent: what you actually eat, at the amounts you eat it. One
              action per row — the star lives on search results and the
              Favourites shelf, so this list stays a list of things to log. ── */}
          {tab === 'recent' && (
            <div className="mt-2">
              {shownRecent.length > 0 ? (
                <ul className="divide-y divide-hairline">
                  {shownRecent.map((food) => (
                    <li key={food.id}>
                      <FoodResult
                        food={food}
                        onSelect={setSelected}
                        onQuickAdd={(f) => addFromList(f, 'log_again', true)}
                        isQuickAdding={quickAddingId === food.id}
                        lastPortion={lastPortionFor(food)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-1 py-10 text-center">
                  <p className="text-body font-medium text-ink">Nothing logged yet</p>
                  <p className="mt-1 text-caption text-ink-3">
                    Search above — 850+ Indian dishes, staples and packaged foods.
                  </p>
                </div>
              )}

              {oftenFoods.length > 0 && (
                <>
                  <ShortcutHeading title="Often" hint="tap + to log again" />
                  <ul className="divide-y divide-hairline">
                    {oftenFoods.map((food) => (
                      <li key={food.id}>
                        <FoodResult
                          food={food}
                          onSelect={setSelected}
                          onQuickAdd={(f) => addFromList(f, 'log_again', true)}
                          isQuickAdding={quickAddingId === food.id}
                          lastPortion={lastPortionFor(food)}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Copy yesterday — only on today's view (it copies into today) */}
              {isToday && hasYesterdayLogs && (
                <div className="mt-2 border-t border-hairline pt-2">
                  <CopyYesterdayButton copying={copying} onClick={copyYesterday} />
                </div>
              )}

              {idleExtras}
            </div>
          )}

          {/* ── Favourites: the shelf the user curates by hand ── */}
          {tab === 'favourites' && (
            <div className="mt-2">
              {favouriteFoods.length > 0 ? (
                <ul className="divide-y divide-hairline">
                  {favouriteFoods.map((food) => (
                    <li key={food.id}>
                      <FoodResult
                        food={food}
                        onSelect={setSelected}
                        onQuickAdd={(f) => addFromList(f, 'log_again')}
                        isQuickAdding={quickAddingId === food.id}
                        isFavourite={favouriteIds.has(food.id)}
                        onToggleFavourite={toggleFavourite}
                        lastPortion={lastPortionFor(food)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-1 py-10 text-center">
                  <p className="text-body font-medium text-ink">No favourites yet</p>
                  <p className="mt-1 text-caption text-ink-3">Tap the star on any food to keep it here.</p>
                </div>
              )}
            </div>
          )}

          {/* ── My foods: saved combos and the things you made ── */}
          {tab === 'mine' && (
            <div className="mt-2">
              {savedMeals.length > 0 && (
                <>
                  <ShortcutHeading title="Combos" hint={`one tap → ${defaultMeal}`} />
                  <ul className="divide-y divide-hairline">
                    {savedMeals.map((meal) => {
                      const totalKcal = meal.saved_meal_items.reduce((sum, item) => {
                        return sum + (item.food ? (item.food.kcal_per_100g * item.grams) / 100 : 0)
                      }, 0)
                      return (
                        <li key={meal.id}>
                          <ShortcutRow
                            name={meal.name}
                            detail={`${meal.saved_meal_items.length} items · ${Math.round(totalKcal)} kcal`}
                            tile={<ComboTile />}
                            busy={loggingMealId === meal.id}
                            disabled={!!loggingMealId}
                            actionLabel={`Log ${meal.name}`}
                            onAdd={() => logSavedMeal(meal.id, defaultMeal)}
                            onDelete={deletingSavedMealId === meal.id ? undefined : () => deleteSavedMeal(meal.id)}
                            deleteLabel={`Delete saved meal ${meal.name}`}
                          />
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
              {savedMeals.length === 0 && (
                <p className="px-1 pb-2 pt-4 text-caption text-ink-3">
                  Save any meal from your log as a combo and it lives here — one tap logs the whole thing.
                </p>
              )}
              <div className={savedMeals.length > 0 ? 'mt-2 border-t border-hairline pt-2' : ''}>
                <button
                  type="button"
                  onClick={() => setShowCreateFood(true)}
                  className="flex h-12 w-full items-center gap-3 rounded-control px-1 text-left text-body font-medium text-ink tap-scale transition-colors hover:bg-surface-2"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-surface-2 text-ink-2">
                    <PlusCircle className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  Create a custom food
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(true)}
                  className="flex h-12 w-full items-center gap-3 rounded-control px-1 text-left text-body font-medium text-ink tap-scale transition-colors hover:bg-surface-2"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-surface-2 text-ink-2">
                    <Zap className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  Quick add calories
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showChat ? <ChatLogModal onClose={() => setShowChat(false)} logDate={logDate} /> : null}
      {selected ? <AddFoodModal food={selected} onClose={() => setSelected(null)} logDate={logDate} targets={targets} /> : null}
      {showQuickAdd ? <QuickAddModal onClose={() => setShowQuickAdd(false)} logDate={logDate} /> : null}
      {showCamera ? (
        <CameraModal
          logDate={logDate}
          onClose={() => setShowCamera(false)}
          onFoodFound={(food) => { setShowCamera(false); setSelected(food) }}
        />
      ) : null}
      {showCreateFood ? (
        <CreateFoodModal
          initialName={debounced}
          isPro={isPro}
          onClose={() => setShowCreateFood(false)}
          onCreated={(food) => {
            setShowCreateFood(false)
            setSelected(food)
          }}
        />
      ) : null}
    </div>
  )
}

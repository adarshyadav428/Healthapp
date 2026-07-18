'use client'

import dynamic from 'next/dynamic'
import type { Food } from '../../types/index'
import { FoodResult } from './FoodResult'
import { Clock, Copy, Star, Zap, PlusCircle, Search, X, BookOpen, Trash2, ScanLine, MessageSquarePlus, RotateCcw, Plus, Loader2 } from 'lucide-react'
import { useFoodSearch, type RecentLogItem } from '../../hooks/useFoodSearch'

// Modals are only opened on user action — defer their JS until then.
const AddFoodModal    = dynamic(() => import('./AddFoodModal').then(m => m.AddFoodModal),       { ssr: false })
const CreateFoodModal = dynamic(() => import('./CreateFoodModal').then(m => m.CreateFoodModal), { ssr: false })
const CameraModal     = dynamic(() => import('../camera/CameraModal').then(m => m.CameraModal), { ssr: false })
const ChatLogModal    = dynamic(() => import('../chat/ChatLogModal').then(m => m.ChatLogModal),  { ssr: false })

type Props = {
  recentFoods: Food[]
  recentLogItems?: RecentLogItem[]
  frequentFoods: Food[]
  hasYesterdayLogs: boolean
  /** The IST day being viewed (YYYY-MM-DD). Logs target this day (backfill). */
  logDate?: string
  /** Whether the viewed day is today — gates today-only surfaces. */
  isToday?: boolean
}

export function FoodSearch({ recentFoods, recentLogItems = [], frequentFoods, hasYesterdayLogs, logDate, isToday = true }: Props) {
  const {
    query, setQuery, debounced, isSearching, data, isLoading, error,
    showRecent, showFrequent, defaultMeal,
    savedMeals, loggingMealId, deletingSavedMealId, logSavedMeal, deleteSavedMeal,
    copying, copyYesterday, quickAddingId, quickAdd, reLogItem,
    favouriteFoods, favouriteIds, toggleFavourite,
    selected, setSelected, showCamera, setShowCamera, showChat, setShowChat,
    showCreateFood, setShowCreateFood,
  } = useFoodSearch({ recentFoods, recentLogItems, frequentFoods, logDate })

  return (
    <div className="space-y-5">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--ink-3)' }} />
        <input
          placeholder="Search dal makhani, roti, paneer..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-28 h-12 text-[14px] rounded-2xl outline-none transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--brand-soft)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--hairline)'; e.currentTarget.style.boxShadow = 'none' }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query.length > 0 && (
            <button type="button" onClick={() => setQuery('')} className="rounded-full p-1" style={{ color: 'var(--ink-3)' }}>
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowChat(true)}
            className="rounded-full p-1.5 transition-colors"
            style={{ color: 'var(--brand)' }}
            aria-label="Log meal with AI chat"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            className="rounded-full p-1.5 transition-colors"
            style={{ color: 'var(--brand)' }}
            aria-label="Scan barcode or take photo"
          >
            <ScanLine className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Re-log chips */}
      {!isSearching && recentLogItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Re-log · same portion as last time</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {recentLogItems.map((item) => {
              const isAdding = quickAddingId === item.food.id
              return (
                <button
                  key={item.food.id}
                  type="button"
                  onClick={() => reLogItem(item)}
                  disabled={isAdding}
                  className="flex-shrink-0 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left tap-scale disabled:opacity-50 transition-all"
                  style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
                >
                  <div>
                    <p className="text-xs font-bold max-w-[120px] truncate leading-tight" style={{ color: 'var(--ink)' }}>{item.food.name}</p>
                    <p className="text-[10px] leading-tight" style={{ color: 'var(--ink-3)' }}>{Math.round(item.grams)}g · {Math.round(item.kcal)} kcal</p>
                  </div>
                  {isAdding
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" style={{ color: 'var(--brand)' }} />
                    : <Plus className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--brand)' }} />
                  }
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Copy yesterday banner — only on today's view (copies into today) */}
      {isToday && hasYesterdayLogs && !isSearching && (
        <button
          type="button"
          onClick={copyYesterday}
          disabled={copying}
          className="flex w-full items-center gap-3 rounded-card border border-hairline bg-surface-2 px-4 py-3 text-left tap-scale disabled:opacity-50 transition-colors"
        >
          <Copy className="h-4 w-4 flex-shrink-0 text-brand" strokeWidth={1.75} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">
              {copying ? 'Copying...' : "Copy yesterday's meals"}
            </p>
            <p className="text-xs text-ink-3">Add all of yesterday&apos;s food to today</p>
          </div>
        </button>
      )}

      {/* Saved meal templates — logging targets today, so hide on past-day views */}
      {isToday && !isSearching && savedMeals.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
            <BookOpen className="h-3.5 w-3.5" />
            <span>Saved meals</span>
          </div>
          <div className="space-y-2">
            {savedMeals.map((meal) => {
              const totalKcal = meal.saved_meal_items.reduce((sum, item) => {
                const kcal = item.food ? (item.food.kcal_per_100g * item.grams) / 100 : 0
                return sum + kcal
              }, 0)
              return (
                <div
                  key={meal.id}
                  className="flex items-center gap-2 rounded-2xl px-4 py-3"
                  style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>{meal.name}</p>
                    <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>{meal.saved_meal_items.length} items · {Math.round(totalKcal)} kcal</p>
                  </div>
                  <select
                    defaultValue={defaultMeal}
                    onChange={(e) => logSavedMeal(meal.id, e.target.value)}
                    disabled={loggingMealId === meal.id}
                    className="text-xs rounded-xl px-2 py-1.5 outline-none transition-all disabled:opacity-50"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => deleteSavedMeal(meal.id)}
                    disabled={deletingSavedMealId === meal.id}
                    className="rounded-full p-1 disabled:opacity-40 transition-colors"
                    style={{ color: 'var(--ink-3)' }}
                    aria-label="Delete saved meal"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Favourites */}
      {!isSearching && favouriteFoods.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
            <Star className="h-3.5 w-3.5" style={{ fill: 'var(--carbs)', color: 'var(--carbs)' }} />
            <span>Favourites</span>
          </div>
          <div className="space-y-2">
            {favouriteFoods.map((food) => (
              <FoodResult
                key={food.id}
                food={food}
                onSelect={setSelected}
                onQuickAdd={quickAdd}
                isQuickAdding={quickAddingId === food.id}
                isFavourite={favouriteIds.has(food.id)}
                onToggleFavourite={toggleFavourite}
              />
            ))}
          </div>
        </div>
      )}

      {/* Frequent foods */}
      {showFrequent && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
            <Zap className="h-3.5 w-3.5" />
            <span>Frequent · tap + to quick add</span>
          </div>
          <div className="space-y-2">
            {frequentFoods.map((food) => (
              <FoodResult
                key={food.id}
                food={food}
                onSelect={setSelected}
                onQuickAdd={quickAdd}
                isQuickAdding={quickAddingId === food.id}
                isFavourite={favouriteIds.has(food.id)}
                onToggleFavourite={toggleFavourite}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent foods */}
      {showRecent && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
            <Clock className="h-3.5 w-3.5" />
            <span>Recent</span>
          </div>
          <div className="space-y-2">
            {recentFoods.map((food) => (
              <FoodResult
                key={food.id}
                food={food}
                onSelect={setSelected}
                onQuickAdd={quickAdd}
                isQuickAdding={quickAddingId === food.id}
                isFavourite={favouriteIds.has(food.id)}
                onToggleFavourite={toggleFavourite}
              />
            ))}
          </div>
        </div>
      )}

      {/* Search results */}
      {isSearching && (
        <div className="space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--hairline)' }} />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm px-1" style={{ color: 'var(--fat)' }}>Search failed. Check your connection and try again.</p>
          ) : (data ?? []).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>No results for &ldquo;{debounced}&rdquo;</p>
              <p className="text-xs mt-1 mb-4" style={{ color: 'var(--ink-3)' }}>Try a different spelling or create a custom food</p>
              <button
                type="button"
                onClick={() => setShowCreateFood(true)}
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white tap-scale transition-all"
                style={{ background: 'var(--brand)' }}
              >
                <PlusCircle className="h-4 w-4" />
                Create &ldquo;{debounced}&rdquo;
              </button>
            </div>
          ) : (
            (data ?? []).map((food) => (
              <FoodResult
                key={food.id}
                food={food}
                onSelect={setSelected}
                onQuickAdd={quickAdd}
                isQuickAdding={quickAddingId === food.id}
                isFavourite={favouriteIds.has(food.id)}
                onToggleFavourite={toggleFavourite}
              />
            ))
          )}
        </div>
      )}

      {/* Empty state when no query and no recent foods */}
      {!isSearching && recentFoods.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-3xl mb-2">🍱</p>
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Search for any food above</p>
          <p className="text-xs mt-1 mb-4" style={{ color: 'var(--ink-3)' }}>Includes 500+ Indian dishes, staples &amp; global foods</p>
          <button
            type="button"
            onClick={() => setShowCreateFood(true)}
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold tap-scale transition-colors"
            style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-ring)', color: 'var(--brand-text)' }}
          >
            <PlusCircle className="h-4 w-4" />
            Create custom food
          </button>
        </div>
      )}

      {showChat ? <ChatLogModal onClose={() => setShowChat(false)} logDate={logDate} /> : null}
      {selected ? <AddFoodModal food={selected} onClose={() => setSelected(null)} logDate={logDate} /> : null}
      {showCamera ? (
        <CameraModal
          onClose={() => setShowCamera(false)}
          onFoodFound={(food) => { setShowCamera(false); setSelected(food) }}
        />
      ) : null}
      {showCreateFood ? (
        <CreateFoodModal
          initialName={debounced}
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

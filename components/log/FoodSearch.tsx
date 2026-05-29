'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Food } from '../../types/index'
import { FoodResult } from './FoodResult'
import { toast } from '../ui/use-toast'
import { Clock, Copy, Star, Zap, PlusCircle, Search, X, BookOpen, Trash2 } from 'lucide-react'
import { useUser } from '../../hooks/useUser'
import { useFoodFavourites } from '../../hooks/useFoodFavourites'

// Modals are only opened on user action — defer their JS until then.
const AddFoodModal    = dynamic(() => import('./AddFoodModal').then(m => m.AddFoodModal),       { ssr: false })
const CreateFoodModal = dynamic(() => import('./CreateFoodModal').then(m => m.CreateFoodModal), { ssr: false })

type SavedMeal = {
  id: string
  name: string
  created_at: string
  saved_meal_items: { food_id: string; grams: number; servings: number; food: { name: string; kcal_per_100g: number } | null }[]
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

type Props = {
  recentFoods: Food[]
  frequentFoods: Food[]
  hasYesterdayLogs: boolean
}

export function FoodSearch({ recentFoods, frequentFoods, hasYesterdayLogs }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [copying, setCopying] = useState(false)
  const [quickAddingId, setQuickAddingId] = useState<string | null>(null)
  const [showCreateFood, setShowCreateFood] = useState(false)
  const debounced = useDebounce(query, 300)
  const queryClient = useQueryClient()
  const { user } = useUser()
  const { favouriteFoods, favouriteIds, toggle: toggleFavourite } = useFoodFavourites(user?.id ?? null)

  // Saved meals
  const { data: savedMeals = [], refetch: refetchSavedMeals } = useQuery({
    queryKey: ['saved-meals', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const res = await fetch('/api/meals/saved')
      if (!res.ok) return []
      return res.json() as Promise<SavedMeal[]>
    },
  })
  const [loggingMealId, setLoggingMealId] = useState<string | null>(null)
  const [deletingSavedMealId, setDeletingSavedMealId] = useState<string | null>(null)

  const logSavedMeal = async (mealId: string, mealType: string) => {
    setLoggingMealId(mealId)
    try {
      const res = await fetch('/api/meals/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal_id: mealId, meal_type: mealType }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to log meal')
      toast({ title: `Logged ${json.logged} items`, duration: 2500 })
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
    } catch (err) {
      toast({ title: 'Could not log meal', description: (err as Error).message, variant: 'error' })
    } finally {
      setLoggingMealId(null)
    }
  }

  const deleteSavedMeal = async (mealId: string) => {
    setDeletingSavedMealId(mealId)
    try {
      const res = await fetch('/api/meals/saved', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mealId }),
      })
      if (!res.ok) throw new Error('Failed')
      refetchSavedMeals()
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setDeletingSavedMealId(null)
    }
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['foods-search', debounced],
    enabled: debounced.trim().length > 1,
    queryFn: async () => {
      const res = await fetch(`/api/foods/search?q=${encodeURIComponent(debounced)}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Search failed')
      return (Array.isArray(json) ? json : []) as Food[]
    },
  })

  const isSearching = debounced.trim().length > 1
  const showRecent = !isSearching && recentFoods.length > 0
  const showFrequent = !isSearching && frequentFoods.length > 0

  const defaultMeal = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 11) return 'breakfast'
    if (hour < 16) return 'lunch'
    if (hour < 21) return 'dinner'
    return 'snack'
  }, [])

  const copyYesterday = async () => {
    if (copying) return
    setCopying(true)
    try {
      const res = await fetch('/api/logs/copy-yesterday', { method: 'POST' })
      const json = (await res.json()) as { ok?: boolean; copied?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to copy')
      toast({
        title: `Copied ${json.copied} meal${(json.copied ?? 0) > 1 ? 's' : ''} from yesterday`,
        description: 'Your log has been updated.',
        duration: 3000,
      })
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
    } catch (err) {
      toast({ title: 'Could not copy', description: (err as Error).message, variant: 'error' })
    } finally {
      setCopying(false)
    }
  }

  const quickAdd = async (food: Food) => {
    if (quickAddingId) return
    setQuickAddingId(food.id)
    try {
      if (!user) throw new Error('You must be signed in to log food.')

      const grams = food.serving_size_g
      const res = await fetch('/api/logs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food_id: food.id,
          meal: defaultMeal,
          servings: 1,
          grams,
        }),
      })

      const body = await res.json().catch(() => ({} as { error?: string }))

      if (!res.ok) throw new Error(body?.error || 'Quick add failed')

      toast({
        title: `Quick added ${food.name}`,
        description: `Logged to ${defaultMeal}. Tap the item to adjust servings.`,
        duration: 2500,
      })
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
    } catch (err) {
      toast({ title: 'Quick add failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setQuickAddingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
        <input
          placeholder="Search dal makhani, roti, paneer..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-10 h-12 text-sm rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-foreground placeholder:text-muted shadow-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 transition-all"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4 text-muted" />
          </button>
        )}
      </div>

      {/* Copy yesterday banner */}
      {hasYesterdayLogs && !isSearching && (
        <button
          type="button"
          onClick={copyYesterday}
          disabled={copying}
          className="flex w-full items-center gap-3 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20 px-4 py-3 text-left hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors disabled:opacity-50"
        >
          <Copy className="h-4 w-4 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              {copying ? 'Copying...' : "Copy yesterday's meals"}
            </p>
            <p className="text-xs text-blue-500 dark:text-blue-400">Add all of yesterday&apos;s food to today</p>
          </div>
        </button>
      )}

      {/* Saved meal templates */}
      {!isSearching && savedMeals.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
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
                <div key={meal.id} className="flex items-center gap-2 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900/80 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{meal.name}</p>
                    <p className="text-[11px] text-muted">{meal.saved_meal_items.length} items · {Math.round(totalKcal)} kcal</p>
                  </div>
                  <select
                    defaultValue={defaultMeal}
                    onChange={(e) => logSavedMeal(meal.id, e.target.value)}
                    disabled={loggingMealId === meal.id}
                    className="text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2 py-1.5 text-foreground outline-none focus:border-orange-400 transition-all disabled:opacity-50"
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
                    className="rounded-full p-1 text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 transition-colors"
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
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
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
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
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
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
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
                <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-red-500 px-1">Search failed. Check your connection and try again.</p>
          ) : (data ?? []).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm font-medium text-foreground">No results for &ldquo;{debounced}&rdquo;</p>
              <p className="text-xs text-muted mt-1 mb-4">Try a different spelling or create a custom food</p>
              <button
                type="button"
                onClick={() => setShowCreateFood(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700 active:scale-[.98] transition-all shadow-sm"
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
          <p className="text-sm font-medium text-foreground">Search for any food above</p>
          <p className="text-xs text-muted mt-1 mb-4">Includes 600+ Indian dishes, staples &amp; global foods</p>
          <button
            type="button"
            onClick={() => setShowCreateFood(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 px-4 py-2 text-sm font-semibold text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Create custom food
          </button>
        </div>
      )}

      {selected ? <AddFoodModal food={selected} onClose={() => setSelected(null)} /> : null}
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

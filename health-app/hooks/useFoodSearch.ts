'use client'

import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Food } from '../types/index'
import { toast } from '../components/ui/use-toast'
import { useUser } from './useUser'
import { useFoodFavourites } from './useFoodFavourites'
import { reportLogMilestone } from '../store/milestoneStore'
import type { LogMilestone } from '../lib/logMilestones'
import { mealForTime } from '../lib/meal'
import { logMetaHeaders } from '../lib/posthog/client'
import type { FoodLogMethod } from '../lib/posthog/events'

export type SavedMeal = {
  id: string
  name: string
  created_at: string
  saved_meal_items: { food_id: string; grams: number; servings: number; food: { name: string; kcal_per_100g: number } | null }[]
}

export type RecentLogItem = { food: Food; grams: number; kcal: number; meal: string }

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

type Params = {
  recentFoods: Food[]
  recentLogItems: RecentLogItem[]
  frequentFoods: Food[]
  logDate?: string
}

/**
 * Food-log search orchestration: debounced query + the search fetch, saved-meal
 * list/log/delete, copy-yesterday, quick-add and re-log, favourites, and the
 * modal-visibility state. Extracted from FoodSearch so the component is pure
 * presentation. Behaviour is intentionally identical to the previous inline code.
 */
export function useFoodSearch({ recentFoods, recentLogItems, frequentFoods, logDate }: Params) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [showChat, setShowChat] = useState(false)
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
        headers: { 'Content-Type': 'application/json', ...logMetaHeaders('meal_template') },
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
    // Keep the previous results visible while the refined query loads —
    // without this every keystroke flashes loading skeletons, which reads as lag.
    placeholderData: keepPreviousData,
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

  const defaultMeal = mealForTime()

  const copyYesterday = async () => {
    if (copying) return
    setCopying(true)
    try {
      const res = await fetch('/api/logs/copy-yesterday', {
        method: 'POST',
        headers: logMetaHeaders('copy_yesterday'),
      })
      const json = (await res.json()) as { ok?: boolean; copied?: number; error?: string; milestone?: LogMilestone }
      if (!res.ok) throw new Error(json.error ?? 'Failed to copy')
      toast({
        title: `Copied ${json.copied} meal${(json.copied ?? 0) > 1 ? 's' : ''} from yesterday`,
        description: 'Your log has been updated.',
        duration: 3000,
      })
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      reportLogMilestone(json.milestone)
    } catch (err) {
      toast({ title: 'Could not copy', description: (err as Error).message, variant: 'error' })
    } finally {
      setCopying(false)
    }
  }

  // `method` is the analytics surface this tap came from: the search-results
  // list is a genuine search, while favourites/frequent/recent are re-logs.
  const quickAdd = async (food: Food, method: FoodLogMethod = 'search') => {
    if (quickAddingId) return
    setQuickAddingId(food.id)
    try {
      if (!user) throw new Error('You must be signed in to log food.')
      const grams = food.serving_size_g
      const res = await fetch('/api/logs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...logMetaHeaders(method) },
        body: JSON.stringify({ food_id: food.id, meal: defaultMeal, servings: 1, grams, date: logDate }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; milestone?: LogMilestone }
      if (!res.ok) throw new Error(body?.error || 'Quick add failed')
      toast({ title: `Quick added ${food.name}`, description: `Logged to ${defaultMeal}. Tap the item to adjust servings.`, duration: 2500 })
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      reportLogMilestone(body.milestone)
    } catch (err) {
      toast({ title: 'Quick add failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setQuickAddingId(null)
    }
  }

  const reLogItem = async (item: RecentLogItem) => {
    if (quickAddingId) return
    setQuickAddingId(item.food.id)
    try {
      if (!user) throw new Error('You must be signed in.')
      const res = await fetch('/api/logs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...logMetaHeaders('log_again') },
        body: JSON.stringify({ food_id: item.food.id, meal: item.meal, servings: 1, grams: item.grams, date: logDate }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; milestone?: LogMilestone }
      if (!res.ok) throw new Error(body?.error || 'Re-log failed')
      toast({ title: `Re-logged ${item.food.name}`, description: `${Math.round(item.grams)}g → ${item.meal}.`, duration: 2500 })
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      reportLogMilestone(body.milestone)
    } catch (err) {
      toast({ title: 'Re-log failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setQuickAddingId(null)
    }
  }

  // recentLogItems is unused inside the hook but kept in the params so callers
  // pass the full render input in one place; the view reads it from props.
  void recentLogItems

  return {
    // search
    query, setQuery, debounced, isSearching, data, isLoading, error,
    showRecent, showFrequent, defaultMeal,
    // saved meals
    savedMeals, loggingMealId, deletingSavedMealId, logSavedMeal, deleteSavedMeal,
    // actions
    copying, copyYesterday, quickAddingId, quickAdd, reLogItem,
    // favourites
    favouriteFoods, favouriteIds, toggleFavourite,
    // modal + selection state
    selected, setSelected, showCamera, setShowCamera, showChat, setShowChat,
    showCreateFood, setShowCreateFood,
  }
}

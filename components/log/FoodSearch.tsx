'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import type { Food } from '../../types/index'
import { FoodResult } from './FoodResult'
import { AddFoodModal } from './AddFoodModal'
import { toast } from '../ui/use-toast'
import { Clock, Copy, Star, Zap, PlusCircle } from 'lucide-react'
import { CreateFoodModal } from './CreateFoodModal'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { useUser } from '../../hooks/useUser'
import { useSubscription } from '../../hooks/useSubscription'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import Link from 'next/link'

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
  const [showLimit, setShowLimit] = useState(false)
  const [showCreateFood, setShowCreateFood] = useState(false)
  const debounced = useDebounce(query, 300)
  const queryClient = useQueryClient()
  const { user } = useUser()
  const { data: subscription } = useSubscription(user?.id ?? null)

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
      const supabase = getBrowserSupabaseClient()
      const today = new Date()
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString()
      const endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1)).toISOString()

      const { count, error: countError } = await supabase
        .from('food_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('logged_at', start)
        .lt('logged_at', endDate)

      if (countError) throw new Error(countError.message)

      if (!subscription?.isPro && (count ?? 0) >= 5) {
        setShowLimit(true)
        return
      }

      const grams = food.serving_size_g
      const factor = grams / 100
      const round2 = (n: number) => Math.round(n * 100) / 100
      const nutrition = {
        kcal: round2(food.kcal_per_100g * factor),
        protein: round2(food.protein_g_per_100g * factor),
        carbs: round2(food.carbs_g_per_100g * factor),
        fat: round2(food.fat_g_per_100g * factor),
      }

      const { error } = await supabase.from('food_logs').insert({
        user_id: user.id,
        food_id: food.id,
        meal: defaultMeal,
        servings: 1,
        grams,
        kcal: nutrition.kcal,
        protein_g: nutrition.protein,
        carbs_g: nutrition.carbs,
        fat_g: nutrition.fat,
        logged_at: new Date().toISOString(),
      })

      if (error) throw new Error(error.message)

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
        <Input
          placeholder="Search Indian &amp; global foods..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-4 pr-4 h-12 text-base rounded-xl border-gray-200 bg-white shadow-sm"
          autoComplete="off"
        />
      </div>

      {/* Copy yesterday banner */}
      {hasYesterdayLogs && !isSearching && (
        <button
          type="button"
          onClick={copyYesterday}
          disabled={copying}
          className="flex w-full items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-left hover:bg-blue-100 transition-colors disabled:opacity-50"
        >
          <Copy className="h-4 w-4 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-700">
              {copying ? 'Copying...' : "Copy yesterday's meals"}
            </p>
            <p className="text-xs text-blue-500">Add all of yesterday&apos;s food to today</p>
          </div>
        </button>
      )}

      {/* Recent foods */}
      {showFrequent && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <Star className="h-3.5 w-3.5" />
            <span>Frequent</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Zap className="h-3.5 w-3.5" />
            <span>Tap + to quick add</span>
          </div>
          <div className="space-y-2">
            {frequentFoods.map((food) => (
              <FoodResult
                key={food.id}
                food={food}
                onSelect={setSelected}
                onQuickAdd={quickAdd}
                isQuickAdding={quickAddingId === food.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent foods */}
      {showRecent && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
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
                <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-red-500 px-1">Search failed. Check your connection and try again.</p>
          ) : (data ?? []).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm font-medium text-gray-600">No results for &ldquo;{debounced}&rdquo;</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Try a different spelling or create a custom food</p>
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
              />
            ))
          )}
        </div>
      )}

      {/* Empty state when no query and no recent foods */}
      {!isSearching && recentFoods.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-3xl mb-2">🍱</p>
          <p className="text-sm font-medium text-gray-600">Search for any food above</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Includes 600+ Indian dishes, staples &amp; global foods</p>
          <button
            type="button"
            onClick={() => setShowCreateFood(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 transition-colors"
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
      <FoodSearchLimitDialog open={showLimit} onOpenChange={setShowLimit} />
    </div>
  )
}

// Limit dialog rendered at sibling level — not nested — to avoid focus/portal conflicts
function FoodSearchLimitDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade to keep logging</DialogTitle>
          <DialogDescription>
            You&apos;ve logged 5 meals today. Upgrade to Pro for unlimited logs.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button asChild>
            <Link href="/upgrade">Upgrade for $9.99/mo</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

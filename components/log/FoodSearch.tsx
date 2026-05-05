'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import type { Food, FoodLog } from '../../types/index'
import { FoodResult } from './FoodResult'
import { AddFoodModal } from './AddFoodModal'
import { toast } from '../ui/use-toast'
import { Clock, Copy } from 'lucide-react'

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
  hasYesterdayLogs: boolean
  yesterdayLogs: FoodLog[]
}

export function FoodSearch({ recentFoods, hasYesterdayLogs }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [copying, setCopying] = useState(false)
  const debounced = useDebounce(query, 300)
  const queryClient = useQueryClient()

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
      {showRecent && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <Clock className="h-3.5 w-3.5" />
            <span>Recent</span>
          </div>
          <div className="space-y-2">
            {recentFoods.map((food) => (
              <FoodResult key={food.id} food={food} onSelect={setSelected} />
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
              <p className="text-sm font-medium text-gray-600">No foods found for &ldquo;{debounced}&rdquo;</p>
              <p className="text-xs text-gray-400 mt-1">Try a different spelling or search in English</p>
            </div>
          ) : (
            (data ?? []).map((food) => (
              <FoodResult key={food.id} food={food} onSelect={setSelected} />
            ))
          )}
        </div>
      )}

      {/* Empty state when no query and no recent foods */}
      {!isSearching && recentFoods.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-3xl mb-2">🍱</p>
          <p className="text-sm font-medium text-gray-600">Search for any food above</p>
          <p className="text-xs text-gray-400 mt-1">Includes 300+ Indian dishes, breads, and more</p>
        </div>
      )}

      {selected ? <AddFoodModal food={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}

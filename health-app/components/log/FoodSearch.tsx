'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '../ui/input'
import type { Food } from '../../types/index'
import { FoodResult } from './FoodResult'
import { AddFoodModal } from './AddFoodModal'

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export function FoodSearch() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const debounced = useDebounce(query, 300)

  const { data, isLoading, error } = useQuery({
    queryKey: ['foods-search', debounced],
    enabled: debounced.trim().length > 1,
    queryFn: async () => {
      const res = await fetch(`/api/foods/search?q=${encodeURIComponent(debounced)}`)
      if (!res.ok) throw new Error('Search failed')
      return (await res.json()) as Food[]
    },
  })

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search foods..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {isLoading ? <p className="text-sm text-gray-500">Searching...</p> : null}
      {error ? <p className="text-sm text-red-500">Search failed. Try again.</p> : null}

      <div className="space-y-2">
        {(data ?? []).map((food) => (
          <FoodResult key={food.id} food={food} onSelect={(f) => setSelected(f)} />
        ))}
      </div>

      {selected ? <AddFoodModal food={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}

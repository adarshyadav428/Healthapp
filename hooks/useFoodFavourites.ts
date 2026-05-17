'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Food } from '../types/index'
import { toast } from '../components/ui/use-toast'

type FavouriteRow = { id: string; food_id: string; food: Food }

export function useFoodFavourites(userId: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery<FavouriteRow[]>({
    queryKey: ['food-favourites', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const res = await fetch('/api/foods/favourites')
      if (!res.ok) return []
      return res.json()
    },
  })

  const favouriteFoods = (query.data ?? []).map((r) => r.food).filter(Boolean)
  const favouriteIds = new Set((query.data ?? []).map((r) => r.food_id))

  const toggle = async (food: Food) => {
    if (!userId) return
    const isFav = favouriteIds.has(food.id)

    // Optimistic update
    queryClient.setQueryData<FavouriteRow[]>(['food-favourites', userId], (old = []) =>
      isFav
        ? old.filter((r) => r.food_id !== food.id)
        : [{ id: crypto.randomUUID(), food_id: food.id, food }, ...old]
    )

    try {
      const res = await fetch('/api/foods/favourites', {
        method: isFav ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ food_id: food.id }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      // Roll back
      queryClient.invalidateQueries({ queryKey: ['food-favourites', userId] })
      toast({ title: 'Could not update favourites', variant: 'error' })
    }
  }

  return { favouriteFoods, favouriteIds, isLoading: query.isLoading, toggle }
}

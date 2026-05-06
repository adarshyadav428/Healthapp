'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Food } from '../../types/index'
import { toast } from '../ui/use-toast'
import { Search, Plus, Trash2, ChefHat, Loader2, X } from 'lucide-react'

type Ingredient = {
  food: Food
  grams: number
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function useFoodSearch(query: string) {
  return useQuery({
    queryKey: ['recipe-food-search', query],
    enabled: query.trim().length > 1,
    queryFn: async () => {
      const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Search failed')
      return (Array.isArray(json) ? json : []) as Food[]
    },
  })
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function RecipeBuilder() {
  const [recipeName, setRecipeName] = useState('')
  const [servings, setServings] = useState(4)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const debouncedQuery = useDebounce(query, 300)
  const { data: searchResults, isLoading: searching } = useFoodSearch(debouncedQuery)

  const totalNutrition = useMemo(() => {
    return ingredients.reduce(
      (acc, ing) => {
        const factor = ing.grams / 100
        acc.kcal += ing.food.kcal_per_100g * factor
        acc.protein += ing.food.protein_g_per_100g * factor
        acc.carbs += ing.food.carbs_g_per_100g * factor
        acc.fat += ing.food.fat_g_per_100g * factor
        acc.totalGrams += ing.grams
        return acc
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0, totalGrams: 0 }
    )
  }, [ingredients])

  const perServing = useMemo(() => {
    if (servings <= 0) return totalNutrition
    return {
      kcal: totalNutrition.kcal / servings,
      protein: totalNutrition.protein / servings,
      carbs: totalNutrition.carbs / servings,
      fat: totalNutrition.fat / servings,
      totalGrams: totalNutrition.totalGrams / servings,
    }
  }, [totalNutrition, servings])

  const addIngredient = (food: Food) => {
    const existing = ingredients.find((i) => i.food.id === food.id)
    if (existing) {
      toast({ title: 'Already added', description: 'Adjust the grams below.', duration: 2000 })
    } else {
      setIngredients((prev) => [...prev, { food, grams: food.serving_size_g }])
    }
    setQuery('')
    setSearchOpen(false)
  }

  const updateGrams = (index: number, grams: number) => {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, grams } : ing)))
  }

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  const saveAsCustomFood = async () => {
    if (!recipeName.trim()) {
      toast({ title: 'Add a recipe name', variant: 'error', duration: 2000 })
      return
    }
    if (ingredients.length === 0) {
      toast({ title: 'Add at least one ingredient', variant: 'error', duration: 2000 })
      return
    }

    setSaving(true)
    try {
      const servingGrams = round1(perServing.totalGrams)
      const factor100 = servingGrams > 0 ? 100 / servingGrams : 0

      const res = await fetch('/api/foods/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: recipeName.trim(),
          brand: 'My Recipe',
          serving_size_g: round1(servingGrams),
          serving_description: `1 serving (${Math.round(servingGrams)}g)`,
          kcal_per_100g: round1(perServing.kcal * factor100),
          protein_g_per_100g: round1(perServing.protein * factor100),
          carbs_g_per_100g: round1(perServing.carbs * factor100),
          fat_g_per_100g: round1(perServing.fat * factor100),
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')

      toast({
        title: '✅ Recipe saved!',
        description: `"${recipeName}" added to your custom foods. Search for it to log.`,
        duration: 4000,
      })

      // Reset
      setRecipeName('')
      setIngredients([])
      setServings(4)
    } catch (err) {
      toast({ title: 'Failed to save', description: (err as Error).message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Recipe name + servings */}
      <div className="rounded-3xl border border-orange-100 dark:border-orange-900/30 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm space-y-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Recipe name</label>
          <input
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
            placeholder="e.g. Dal Makhani, Palak Paneer..."
            className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-2.5 text-sm text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">
            Servings this recipe makes
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setServings(Math.max(1, servings - 1))}
              className="h-9 w-9 rounded-full bg-gray-100 dark:bg-slate-800 text-lg font-bold text-foreground hover:bg-gray-200 dark:hover:bg-slate-700 active:scale-90 transition-all"
            >
              −
            </button>
            <span className="text-2xl font-black text-foreground w-8 text-center">{servings}</span>
            <button
              type="button"
              onClick={() => setServings(servings + 1)}
              className="h-9 w-9 rounded-full bg-gray-100 dark:bg-slate-800 text-lg font-bold text-foreground hover:bg-gray-200 dark:hover:bg-slate-700 active:scale-90 transition-all"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Ingredient search */}
      <div className="rounded-3xl border border-gray-100 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ingredients</p>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <input
            placeholder="Search & add ingredients..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSearchOpen(true) }}
            onFocus={() => setSearchOpen(true)}
            className="w-full pl-9 pr-9 h-10 text-sm rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 transition-all"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setSearchOpen(false) }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted" />
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {searchOpen && query.length > 1 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {searching ? (
              <div className="flex justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
              </div>
            ) : (searchResults ?? []).length === 0 ? (
              <p className="text-xs text-muted text-center py-3">No results — try another search</p>
            ) : (
              (searchResults ?? []).map((food) => (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => addIngredient(food)}
                  className="w-full flex items-center justify-between rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-left hover:border-orange-200 dark:hover:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all group"
                >
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-sm font-semibold text-foreground truncate">{food.name}</p>
                    <p className="text-[11px] text-muted">{Math.round(food.kcal_per_100g)} kcal · {Math.round(food.protein_g_per_100g)}P {Math.round(food.carbs_g_per_100g)}C {Math.round(food.fat_g_per_100g)}F per 100g</p>
                  </div>
                  <Plus className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        )}

        {/* Ingredients list */}
        {ingredients.length > 0 ? (
          <div className="space-y-2 mt-1">
            {ingredients.map((ing, index) => (
              <div key={ing.food.id} className="flex items-center gap-2 rounded-2xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{ing.food.name}</p>
                  <p className="text-[10px] text-muted">
                    {round1(ing.food.kcal_per_100g * ing.grams / 100)} kcal
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={ing.grams}
                    min={1}
                    onChange={(e) => updateGrams(index, Math.max(1, Number(e.target.value)))}
                    className="w-16 text-center text-xs font-bold rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-foreground px-2 py-1.5 outline-none focus:border-orange-400"
                  />
                  <span className="text-[10px] text-muted">g</span>
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="rounded-full p-1 text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-2xl mb-1">🥘</p>
            <p className="text-xs text-muted">Search and add ingredients above</p>
          </div>
        )}
      </div>

      {/* Nutrition summary */}
      {ingredients.length > 0 && (
        <div className="rounded-3xl border border-emerald-100 dark:border-emerald-900/30 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-3">
            Per serving (of {servings}) — {Math.round(perServing.totalGrams)}g
          </p>
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{Math.round(perServing.kcal)}</p>
              <p className="text-[11px] text-emerald-500 dark:text-emerald-400">kcal</p>
            </div>
            <div className="flex gap-3 ml-2">
              <MacroStat value={round1(perServing.protein)} label="Protein" color="text-blue-600" />
              <MacroStat value={round1(perServing.carbs)} label="Carbs" color="text-amber-600" />
              <MacroStat value={round1(perServing.fat)} label="Fat" color="text-rose-600" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-emerald-100/50 dark:border-emerald-900/30">
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Total recipe: {Math.round(totalNutrition.kcal)} kcal · {Math.round(totalNutrition.totalGrams)}g
            </p>
          </div>
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={saveAsCustomFood}
        disabled={saving || ingredients.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-3xl bg-orange-600 py-4 text-sm font-bold text-white hover:bg-orange-700 active:scale-[.98] transition-all shadow-md disabled:opacity-50"
      >
        {saving ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
        ) : (
          <><ChefHat className="h-4 w-4" /> Save as custom food</>
        )}
      </button>
      <p className="text-xs text-muted text-center -mt-2">
        Saves to your custom foods — search for it on the Log page to track it
      </p>
    </div>
  )
}

function MacroStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-base font-black ${color}`}>{value}g</p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  )
}

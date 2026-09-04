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

      // Creating a custom food is Pro-gated server-side (402). Without this
      // branch the recipe builder fell through to the generic throw and showed
      // the raw "Pro required" string in a failure toast — an error, not an
      // upgrade path. Mirror CreateFoodModal: send them to the paywall.
      if (res.status === 402) {
        window.location.href = '/upgrade?reason=custom_foods'
        return
      }

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
      <div className="rounded-sheet border border-hairline bg-surface p-4 shadow-rest space-y-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-3 mb-1">Recipe name</label>
          <input
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
            placeholder="e.g. Dal Makhani, Palak Paneer..."
            className="w-full rounded-control border border-hairline bg-surface-2 px-4 py-2.5 text-base text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-3 mb-1">
            Servings this recipe makes
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setServings(Math.max(1, servings - 1))}
              className="h-9 w-9 rounded-full bg-surface-2 text-lg font-bold text-ink hover:bg-hairline active:scale-90 transition-all"
            >
              −
            </button>
            <span className="font-display text-2xl font-bold text-ink w-8 text-center">{servings}</span>
            <button
              type="button"
              onClick={() => setServings(servings + 1)}
              className="h-9 w-9 rounded-full bg-surface-2 text-lg font-bold text-ink hover:bg-hairline active:scale-90 transition-all"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Ingredient search */}
      <div className="rounded-sheet border border-hairline bg-surface p-4 shadow-rest space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Ingredients</p>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-3 pointer-events-none" />
          <input
            placeholder="Search & add ingredients..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSearchOpen(true) }}
            onFocus={() => setSearchOpen(true)}
            className="w-full pl-9 pr-9 h-10 text-base rounded-control border border-hairline bg-surface-2 text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring transition-all"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setSearchOpen(false) }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-ink-3" />
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {searchOpen && query.length > 1 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {searching ? (
              <div className="flex justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-brand" />
              </div>
            ) : (searchResults ?? []).length === 0 ? (
              <p className="text-xs text-ink-2 text-center py-3">No results — try another search</p>
            ) : (
              (searchResults ?? []).map((food) => (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => addIngredient(food)}
                  className="w-full flex items-center justify-between rounded-control border border-hairline bg-surface px-3 py-2 text-left hover:border-brand-ring hover:bg-brand-soft transition-all group"
                >
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-sm font-semibold text-ink truncate">{food.name}</p>
                    <p className="text-[11px] text-ink-2">{Math.round(food.kcal_per_100g)} kcal · {Math.round(food.protein_g_per_100g)}P {Math.round(food.carbs_g_per_100g)}C {Math.round(food.fat_g_per_100g)}F per 100g</p>
                  </div>
                  <Plus className="h-4 w-4 text-brand flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        )}

        {/* Ingredients list */}
        {ingredients.length > 0 ? (
          <div className="space-y-2 mt-1">
            {ingredients.map((ing, index) => (
              <div key={ing.food.id} className="flex items-center gap-2 rounded-card border border-hairline bg-surface-2 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-ink truncate">{ing.food.name}</p>
                  <p className="text-[10px] text-ink-2">
                    {round1(ing.food.kcal_per_100g * ing.grams / 100)} kcal
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={ing.grams}
                    min={1}
                    onChange={(e) => updateGrams(index, Math.max(1, Number(e.target.value)))}
                    className="w-16 text-center text-base font-bold rounded-control border border-hairline bg-surface text-ink px-2 py-1.5 outline-none focus:border-brand"
                  />
                  <span className="text-[10px] text-ink-2">g</span>
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="rounded-full p-1 text-ink-3 hover:text-danger hover:bg-danger-soft transition-colors"
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
            <p className="text-xs text-ink-2">Search and add ingredients above</p>
          </div>
        )}
      </div>

      {/* Nutrition summary */}
      {ingredients.length > 0 && (
        <div className="rounded-sheet border border-hairline bg-surface bg-hero-wash p-4 shadow-rest">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink mb-3">
            Per serving (of {servings}) — {Math.round(perServing.totalGrams)}g
          </p>
          <div className="flex gap-4">
            <div className="text-center">
              <p className="font-display text-2xl font-bold text-ink">{Math.round(perServing.kcal)}</p>
              <p className="text-[11px] text-ink-2">kcal</p>
            </div>
            <div className="flex gap-3 ml-2">
              <MacroStat value={round1(perServing.protein)} label="Protein" color="text-protein" />
              <MacroStat value={round1(perServing.carbs)} label="Carbs" color="text-carbs" />
              <MacroStat value={round1(perServing.fat)} label="Fat" color="text-fat" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-hairline">
            <p className="text-[11px] text-ink-2 font-medium">
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
        className="flex w-full items-center justify-center gap-2 rounded-full bg-cta-grad py-4 text-sm font-bold text-white hover:brightness-105 active:scale-[.98] transition-all shadow-cta disabled:opacity-50"
      >
        {saving ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
        ) : (
          <><ChefHat className="h-4 w-4" /> Save as custom food</>
        )}
      </button>
      <p className="text-xs text-ink-2 text-center -mt-2">
        Saves to your custom foods — search for it on the Log page to track it
      </p>
    </div>
  )
}

function MacroStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-base font-bold ${color}`}>{value}g</p>
      <p className="text-[10px] text-ink-2">{label}</p>
    </div>
  )
}

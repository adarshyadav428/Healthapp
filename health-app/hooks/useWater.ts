'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'water_log'

type WaterStore = {
  date: string   // YYYY-MM-DD UTC
  ml: number
}

function todayUtc(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
}

function read(): WaterStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { date: todayUtc(), ml: 0 }
    const parsed = JSON.parse(raw) as WaterStore
    if (parsed.date !== todayUtc()) return { date: todayUtc(), ml: 0 } // reset at midnight
    return parsed
  } catch {
    return { date: todayUtc(), ml: 0 }
  }
}

function write(store: WaterStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function useWater(targetMl = 2500) {
  const [ml, setMl] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMl(read().ml)
    setMounted(true)
  }, [])

  const add = useCallback((amount: number) => {
    setMl((prev) => {
      const next = Math.max(0, prev + amount)
      write({ date: todayUtc(), ml: next })
      return next
    })
  }, [])

  const reset = useCallback(() => {
    write({ date: todayUtc(), ml: 0 })
    setMl(0)
  }, [])

  const cups = Math.floor(ml / 250)
  const targetCups = Math.floor(targetMl / 250)
  const pct = targetMl > 0 ? Math.min((ml / targetMl) * 100, 100) : 0

  return { ml, cups, targetMl, targetCups, pct, add, reset, mounted }
}

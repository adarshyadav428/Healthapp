'use client'

import { useCallback, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === 'light' || stored === 'dark') return stored
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    const initial = getPreferredTheme()
    setThemeState(initial)
    applyTheme(initial)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    applyTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore storage errors
    }
  }, [])

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // ignore storage errors
      }
      return next
    })
  }, [])

  return { theme, setTheme, toggle }
}

import { create } from 'zustand'
import type { Profile } from '../types/index'
import { getBrowserSupabaseClient } from '../lib/supabase/client'

type UserState = {
  user: { id: string; email: string } | null
  profile: Profile | null
  isLoading: boolean
  error: string | null
  setUser: (user: { id: string; email: string } | null) => void
  setProfile: (p: Profile | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  logout: () => Promise<void>
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  profile: null,
  isLoading: false,
  error: null,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  logout: async () => {
    try {
      set({ isLoading: true })
      const supabase = getBrowserSupabaseClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw new Error(error.message)
      set({ user: null, profile: null, isLoading: false })
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },
}))

export default useUserStore

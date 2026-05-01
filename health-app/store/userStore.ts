import { create } from 'zustand'
import type { Profile } from '../types/index'

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
      // Sign out handled by a client utility (supabase) in components; here we just clear state
      set({ user: null, profile: null, isLoading: false })
      // Client-side redirect performed by caller
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },
}))

export default useUserStore

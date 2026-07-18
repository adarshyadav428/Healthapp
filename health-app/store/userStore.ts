import { create } from 'zustand'
import type { Profile } from '../types/index'

/**
 * `isAnonymous` is carried explicitly rather than inferred from an empty
 * email: anonymous users are stored with `email: ''`, and treating "falsy
 * email" as "anonymous" would silently misclassify any registered user whose
 * email failed to load. Gates that decide whether to spend money or show a
 * paywall need the real answer.
 */
type UserState = {
  user: { id: string; email: string; isAnonymous: boolean } | null
  profile: Profile | null
  isLoading: boolean
  error: string | null
  setUser: (user: { id: string; email: string; isAnonymous: boolean } | null) => void
  setProfile: (p: Profile | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
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
}))

export default useUserStore

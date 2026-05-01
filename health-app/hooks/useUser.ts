'use client'

import { useEffect } from 'react'
import { getBrowserSupabaseClient } from '../lib/supabase/client'
import { useUserStore } from '../store/userStore'
import type { Profile } from '../types/index'

export function useUser() {
  const { user, profile, isLoading, error, setUser, setProfile, setLoading, setError } = useUserStore()

  useEffect(() => {
    const supabase = getBrowserSupabaseClient()
    let isMounted = true

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const {
          data: { user: sessionUser },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError) throw new Error(userError.message)

        if (!isMounted) return

        if (!sessionUser) {
          setUser(null)
          setProfile(null)
          return
        }

        setUser({ id: sessionUser.id, email: sessionUser.email ?? '' })

        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sessionUser.id)
          .maybeSingle()

        if (profileError) throw new Error(profileError.message)
        setProfile(data as Profile)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }

    load()

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return
      setError(null)
      if (!session?.user) {
        setUser(null)
        setProfile(null)
        return
      }

      setUser({ id: session.user.id, email: session.user.email ?? '' })
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profileError) {
        setError(profileError.message)
      } else {
        setProfile(data as Profile)
      }
    })

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [setUser, setProfile, setLoading, setError])

  return { user, profile, isLoading, error }
}

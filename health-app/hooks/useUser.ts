'use client'

import { useEffect, useRef } from 'react'
import { getBrowserSupabaseClient } from '../lib/supabase/client'
import { useUserStore } from '../store/userStore'
import { identifyUser, resetIdentity } from '../lib/posthog/client'
import { readFirstTouch, firstTouchPersonProps } from '../lib/attribution'
import type { Profile } from '../types/index'

export function useUser() {
  const { user, profile, isLoading, error, setUser, setProfile, setLoading, setError } = useUserStore()
  // Incrementing counter used to discard stale async responses
  const reqIdRef = useRef(0)

  useEffect(() => {
    const supabase = getBrowserSupabaseClient()
    let isMounted = true

    const fetchProfile = async (userId: string, reqId: number) => {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (!isMounted || reqId !== reqIdRef.current) return
      if (profileError) {
        setError(profileError.message)
      } else {
        setProfile(data as Profile | null)
      }
    }

    const load = async () => {
      const reqId = ++reqIdRef.current
      try {
        setLoading(true)
        setError(null)
        const {
          data: { session },
          error: userError,
        } = await supabase.auth.getSession()
        if (userError) throw new Error(userError.message)
        const sessionUser = session?.user ?? null

        if (!isMounted || reqId !== reqIdRef.current) return

        if (!sessionUser) {
          setUser(null)
          setProfile(null)
          return
        }

        setUser({ id: sessionUser.id, email: sessionUser.email ?? '' })
        identifyUser(
          sessionUser.id,
          { email: sessionUser.email },
          firstTouchPersonProps(readFirstTouch()),
        )
        await fetchProfile(sessionUser.id, reqId)
      } catch (err) {
        if (isMounted && reqId === reqIdRef.current) setError((err as Error).message)
      } finally {
        if (isMounted && reqId === reqIdRef.current) setLoading(false)
      }
    }

    load()

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return
      const reqId = ++reqIdRef.current
      setError(null)

      if (!session?.user) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        resetIdentity()
        return
      }

      setUser({ id: session.user.id, email: session.user.email ?? '' })
      identifyUser(
        session.user.id,
        { email: session.user.email },
        firstTouchPersonProps(readFirstTouch()),
      )
      await fetchProfile(session.user.id, reqId)
    })

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [setUser, setProfile, setLoading, setError])

  return { user, profile, isLoading, error }
}

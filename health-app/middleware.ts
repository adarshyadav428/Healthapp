import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSupabaseSession } from './lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = ['/', '/auth', '/api', '/_next', '/favicon.ico']

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const response = await updateSupabaseSession(request)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return response

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value
      },
      set(name, value, options) {
        response.cookies.set({ name, value, ...options })
      },
      remove(name, options) {
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes
  if (isPublic(pathname)) {
    if (user && pathname.startsWith('/auth')) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
    return response
  }

  // Protected routes require auth
  if (!user) {
    const signInUrl = request.nextUrl.clone()
    signInUrl.pathname = '/auth/sign-in'
    signInUrl.search = `returnTo=${encodeURIComponent(request.nextUrl.pathname)}`
    return NextResponse.redirect(signInUrl)
  }

  // Authenticated users without profile should go to onboarding
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('height_cm')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return response
  }

  if ((!profile || profile.height_cm === null) && !pathname.startsWith('/onboarding')) {
    const onboardingUrl = request.nextUrl.clone()
    onboardingUrl.pathname = '/onboarding'
    return NextResponse.redirect(onboardingUrl)
  }

  return response
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}

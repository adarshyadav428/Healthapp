import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

type CookieOptions = {
  domain?: string
  path?: string
  expires?: Date
  maxAge?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'lax' | 'strict' | 'none'
}

export async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return response

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })

  // Refresh session if needed
  await supabase.auth.getUser()

  return response
}

const PUBLIC_PATHS = ['/', '/auth', '/api', '/_next', '/favicon.ico']

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function handleSupabaseAuthMiddleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const response = await updateSupabaseSession(request)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    if (isPublic(pathname)) return response
    const signInUrl = request.nextUrl.clone()
    signInUrl.pathname = '/auth/sign-in'
    signInUrl.search = `returnTo=${encodeURIComponent(request.nextUrl.pathname)}`
    return NextResponse.redirect(signInUrl)
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (isPublic(pathname)) {
    if (user && pathname.startsWith('/auth')) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
    return response
  }

  if (!user) {
    const signInUrl = request.nextUrl.clone()
    signInUrl.pathname = '/auth/sign-in'
    signInUrl.search = `returnTo=${encodeURIComponent(request.nextUrl.pathname)}`
    return NextResponse.redirect(signInUrl)
  }

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

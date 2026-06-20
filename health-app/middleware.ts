import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const publicFiles = ['/sw.js', '/manifest.webmanifest']
  const publicPrefixes = ['/icons/', '/.well-known/', '/workbox-', '/fallback-']

  if (
    publicFiles.includes(pathname) ||
    publicPrefixes.some(prefix => pathname.startsWith(prefix))
  ) {
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.next()

  let response = NextResponse.next({ request })

  // NOTE: @supabase/ssr@0.2.0 only calls cookies.get(name) internally —
  // getAll/setAll are silently ignored. We must provide get/set/remove.
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        request.cookies.set(name, value)
        response = NextResponse.next({ request })
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
      },
      remove(name: string, options: Record<string, unknown>) {
        request.cookies.set(name, '')
        response = NextResponse.next({ request })
        response.cookies.set(name, '', options as Parameters<typeof response.cookies.set>[2])
      },
    },
  })

  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const { origin } = request.nextUrl

  const isAuthRoute = pathname.startsWith('/auth/')
  const isApiRoute = pathname.startsWith('/api/')
  const isNextInternal = pathname.startsWith('/_next/')
  const isPublic = pathname === '/' || pathname === '/privacy' || pathname === '/terms' || pathname === '/upgrade'

  // Let API routes and Next.js internals pass through
  if (isApiRoute || isNextInternal) return response

  if (!user) {
    // Unauthenticated: allow public pages and auth routes, redirect everything else
    if (isPublic || isAuthRoute) return response
    const signInUrl = new URL('/auth/sign-in', origin)
    signInUrl.searchParams.set('returnTo', pathname)
    return NextResponse.redirect(signInUrl)
  }

  // Authenticated user on auth pages → redirect to dashboard
  if (isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', origin))
  }

  // Check profile completeness for non-onboarding protected routes
  if (!isPublic && pathname !== '/onboarding') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('height_cm')
      .eq('id', user.id)
      .single()

    if (!profile || profile.height_cm === null) {
      return NextResponse.redirect(new URL('/onboarding', origin))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw\\.js|workbox-.*|manifest\\.webmanifest|icons/.*|\\.well-known/.*).*)',],
}

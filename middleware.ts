import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = ['/', '/auth', '/api', '/_next', '/privacy', '/terms', '/favicon.ico']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname === p)
}

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // If env vars missing, let the page handle it
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.next()
    }

    let response = NextResponse.next({ request })

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    })

    const { data: { user } } = await supabase.auth.getUser()

    // Logged-in user visiting auth page → send to dashboard
    if (user && pathname.startsWith('/auth')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Unauthenticated user visiting protected page → send to sign-in
    if (!user && !isPublicPath(pathname)) {
      const signInUrl = new URL('/auth/sign-in', request.url)
      signInUrl.searchParams.set('returnTo', pathname)
      return NextResponse.redirect(signInUrl)
    }

    return response
  } catch {
    // Never crash the site — if middleware fails just let the request through
    return NextResponse.next()
  }
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}

import type { NextRequest } from 'next/server'
import { handleSupabaseAuthMiddleware } from './lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return handleSupabaseAuthMiddleware(request)
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}

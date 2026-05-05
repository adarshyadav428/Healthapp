import { NextResponse } from 'next/server'
import { createServerClient } from '../../../lib/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = cookies()
  const allCookies = cookieStore.getAll()

  // Filter to only supabase-related cookies for privacy
  const supabaseCookies = allCookies
    .filter((c) => c.name.startsWith('sb-'))
    .map((c) => ({ name: c.name, length: c.value.length }))

  const supabase = createServerClient()
  const { data: { session }, error } = await supabase.auth.getSession()

  return NextResponse.json({
    hasCookies: supabaseCookies.length > 0,
    cookieNames: supabaseCookies,
    hasSession: !!session,
    userId: session?.user?.id ?? null,
    error: error?.message ?? null,
  })
}

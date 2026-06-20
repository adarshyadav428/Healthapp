import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'

export async function POST() {
  try {
    const supabase = createServerClient()
    await supabase.auth.signOut()
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '../../../../lib/supabase/server'

export async function POST() {
  try {
    const supabase = createServerClient()
    const {
      data: { session },
      error: userError,
    } = await supabase.auth.getSession()
    const user = session?.user ?? null

    if (userError) throw new Error(userError.message)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

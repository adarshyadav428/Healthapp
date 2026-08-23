import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { editFoodLogSchema } from '../../../../lib/validations'
import { zodErrorMessage } from '../../../../lib/apiError'

export async function PATCH(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const json = await req.json()
    const parsed = editFoodLogSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: zodErrorMessage(parsed.error, 'Check the amount and try again.') },
        { status: 400 }
      )
    }

    const { id, ...fields } = parsed.data
    const { error } = await supabase
      .from('food_logs')
      .update(fields)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

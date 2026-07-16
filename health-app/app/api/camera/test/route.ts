import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'

// Debug endpoint: lists Gemini models available to the configured key.
// Auth-gated — previously this was public, letting anyone probe whether the
// key was configured and enumerate the account's available models.
export async function GET() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
  )
  const data = await res.json()
  const models = (data?.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes('generateContent')
    )
    .map((m: { name: string }) => m.name)

  return NextResponse.json({ status: res.status, availableModels: models, raw: data?.error ?? null })
}

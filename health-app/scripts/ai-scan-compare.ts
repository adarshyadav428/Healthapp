/**
 * Run real meal photos through the camera scan's EXACT prompt, schema and
 * model settings — the same lib/gemini.ts call the route makes — and print
 * what comes back, side by side, one row per photo per model.
 *
 * No ground truth is needed: this is for eyeballing whether a model or
 * prompt change reads your own plates better, not for a score.
 *
 *   npx tsx scripts/ai-scan-compare.ts <folder-of-photos> [model,model,...]
 *
 * With no model list it runs the app's GEMINI_MODEL only. Pass e.g.
 * `gemini-3.6-flash,gemini-3.5-flash-lite` to compare. Reads GEMINI_API_KEY
 * from .env.local. Photos are downscaled the same way the app does (long edge
 * 1536) before being sent, so results match what a phone would get.
 *
 * Each photo is one paid call per model — on a free-tier key, mind the daily
 * quota (the 2026-09-04 chat eval hit 20 requests/day).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
import { GEMINI_MODEL, buildGeminiBody, geminiUrl, type GeminiCall } from '../lib/gemini'
import { CAMERA_RESPONSE_SCHEMA, resolveNutrition, type GeminiFood, type GeminiScan } from '../lib/camera-nutrition'
import { CAMERA_PROMPT } from '../lib/camera-prompt'

function readEnvKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  const envPath = join(__dirname, '..', '.env.local')
  if (!existsSync(envPath)) throw new Error('No GEMINI_API_KEY in env and no .env.local')
  const line = readFileSync(envPath, 'utf8').split(/\r?\n/).find((l) => l.startsWith('GEMINI_API_KEY='))
  if (!line) throw new Error('GEMINI_API_KEY not in .env.local')
  return line.slice('GEMINI_API_KEY='.length).trim().replace(/^["']|["']$/g, '')
}

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

async function scan(model: string, apiKey: string, base64: string, mimeType: string) {
  const call: GeminiCall = {
    parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: CAMERA_PROMPT }],
    responseSchema: CAMERA_RESPONSE_SCHEMA,
    maxOutputTokens: 4096,
    temperature: 0,
    seed: 42,
    thinking: 'low',
    timeoutMs: 30_000,
  }
  const t0 = Date.now()
  const res = await fetch(geminiUrl(model, apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGeminiBody(call)),
    signal: AbortSignal.timeout(call.timeoutMs),
  })
  const ms = Date.now() - t0
  const json = (await res.json()) as {
    error?: { message?: string }
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>
    usageMetadata?: Record<string, unknown>
  }
  if (!res.ok) return { ms, error: `${res.status} ${json.error?.message ?? ''}`.trim() }
  const text = (json.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('')
  try {
    const parsed = JSON.parse(text) as GeminiScan
    return { ms, parsed, finish: json.candidates?.[0]?.finishReason, usage: json.usageMetadata }
  } catch {
    return { ms, error: `unparseable (finish=${json.candidates?.[0]?.finishReason})`, raw: text.slice(0, 200) }
  }
}

function describe(f: GeminiFood): string {
  const n = resolveNutrition(f)
  const per = n.unit === 'pcs' ? n.kcal_per_100g / 100 : n.kcal_per_100g / 100
  const kcal = Math.round(per * n.portion)
  const flags = [n.fromLabel ? 'label' : '', n.fromServingTotal ? 'pcs-total' : '', !n.plausible ? 'CLAMPED' : '', !n.resolvable ? 'UNRESOLVED' : ''].filter(Boolean).join(',')
  const conf = f.confidence ? ` (${f.confidence})` : ''
  const alts = f.alternatives?.length ? ` — or: ${f.alternatives.join(' / ')}` : ''
  return `${f.name}${conf} — ${Math.round(n.portion)}${n.unit} ≈ ${kcal} kcal${flags ? ` [${flags}]` : ''}${alts}`
}

async function main() {
  const folder = process.argv[2]
  if (!folder) {
    console.error('usage: npx tsx scripts/ai-scan-compare.ts <folder> [model,model]')
    process.exit(1)
  }
  const models = (process.argv[3] ?? GEMINI_MODEL).split(',').map((m) => m.trim()).filter(Boolean)
  const apiKey = readEnvKey()
  const files = readdirSync(folder).filter((f) => MIME[extname(f).toLowerCase()]).sort()
  if (!files.length) {
    console.error(`no .jpg/.png/.webp files in ${resolve(folder)}`)
    process.exit(1)
  }
  console.log(`${files.length} photo(s) × ${models.length} model(s)\n`)

  for (const file of files) {
    const mimeType = MIME[extname(file).toLowerCase()]
    const base64 = readFileSync(join(folder, file)).toString('base64')
    console.log(`━━━ ${file}  (${Math.round((base64.length * 3) / 4 / 1024)} KB as sent)`)
    for (const model of models) {
      const r = await scan(model, apiKey, base64, mimeType)
      if ('error' in r && r.error) {
        console.log(`  ${model.padEnd(26)} ${String(r.ms).padStart(6)} ms  ERROR ${r.error}${r.raw ? `\n     raw: ${r.raw}` : ''}`)
        continue
      }
      const p = r.parsed!
      console.log(`  ${model.padEnd(26)} ${String(r.ms).padStart(6)} ms  setting=${p.setting ?? '?'}  confidence=${p.confidence}  items=${p.foods.length}  finish=${r.finish}`)
      if (p.scene) console.log(`     scene: ${p.scene}`)
      for (const f of p.foods) console.log(`     · ${describe(f)}`)
    }
    console.log()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

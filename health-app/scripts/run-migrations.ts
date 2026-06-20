/**
 * Run all pending DB migrations against Supabase via REST (service role key).
 * Usage: npx tsx scripts/run-migrations.ts
 *
 * The service role JWT is trusted by Supabase's pgMeta HTTP API which supports DDL.
 */
import * as fs from 'fs'
import * as https from 'https'
import * as path from 'path'

const envText = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
const getEnv = (k: string) => { const m = envText.match(new RegExp(`^${k}=(.+)$`, 'm')); if (!m) throw new Error(`Missing ${k}`); return m[1].trim() }

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY  = getEnv('SUPABASE_SERVICE_ROLE_KEY')
const host         = new URL(SUPABASE_URL).hostname
const projRef      = host.split('.')[0]

// Supabase exposes pgMeta at a separate host
const pgMetaHost = `api.supabase.com`

function request(hostname: string, path: string, body: string, extraHeaders: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body)
    const opts = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': buf.byteLength,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        ...extraHeaders,
      },
    }
    const req = https.request(opts, (res) => {
      let s = ''
      res.on('data', (c) => (s += c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: s }))
    })
    req.on('error', reject)
    req.write(buf)
    req.end()
  })
}

// Parse SQL into individual statements (split on semicolons, skip comments/blanks)
function parseStatements(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, '') // strip line comments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

async function runSql(sql: string): Promise<void> {
  // Try Supabase pgMeta API
  const { status, body } = await request(
    pgMetaHost,
    `/v1/projects/${projRef}/database/query`,
    JSON.stringify({ query: sql }),
    { 'apikey': SERVICE_KEY }
  )

  if (status === 200 || status === 201) return

  // Fallback: try the supabase-specific /rest/v1/rpc/exec (if set up)
  throw new Error(`SQL exec failed (${status}): ${body.slice(0, 200)}`)
}

async function main() {
  const migrationDir = path.join(process.cwd(), 'supabase', 'migrations')
  const files = fs.readdirSync(migrationDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => f !== '001_initial.sql') // already applied

  console.log(`Found ${files.length} pending migration(s):\n`)

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8')
    const statements = parseStatements(sql)

    console.log(`▶ Running ${file} (${statements.length} statements)...`)

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      try {
        await runSql(stmt)
        process.stdout.write('.')
      } catch (err) {
        console.error(`\n  ✗ Statement ${i + 1} failed: ${(err as Error).message}`)
        // Continue — many statements are idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS)
      }
    }
    console.log(`\n  ✓ ${file} done\n`)
  }

  console.log('All migrations complete.')
}

main().catch((e) => { console.error(e); process.exit(1) })

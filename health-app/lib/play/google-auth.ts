import { JWT } from 'google-auth-library'

// Mints an OAuth access token for the Google Play Developer API using the
// service-account credentials in GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (base64-encoded
// JSON key). The token is cached in module scope until shortly before expiry.

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher'

let jwtClient: JWT | null = null
let cachedToken: { value: string; expiresAt: number } | null = null

function getJwtClient(): JWT {
  if (jwtClient) return jwtClient

  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('Missing GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')

  // Accept either base64-encoded JSON (preferred for env vars) or raw JSON.
  let json: { client_email?: string; private_key?: string }
  try {
    const decoded = raw.trim().startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8')
    json = JSON.parse(decoded)
  } catch {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON or base64-JSON')
  }

  if (!json.client_email || !json.private_key) {
    throw new Error('Service account JSON missing client_email / private_key')
  }

  jwtClient = new JWT({
    email: json.client_email,
    key: json.private_key,
    scopes: [SCOPE],
  })
  return jwtClient
}

/** Returns a valid androidpublisher access token, cached until ~1 min before expiry. */
export async function getPlayAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.value
  }

  const client = getJwtClient()
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('Failed to obtain Play access token')

  // google-auth-library caches internally; mirror its expiry when available.
  const expiry = (client.credentials.expiry_date as number | undefined) ?? Date.now() + 3_000_000
  cachedToken = { value: token, expiresAt: expiry }
  return token
}

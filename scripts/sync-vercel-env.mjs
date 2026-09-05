/**
 * Sync selected keys from local .env to Vercel via PowerShell stdin pipe.
 * Usage: node scripts/sync-vercel-env.mjs
 */
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs'
import { spawnSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomBytes } from 'crypto'

if (!existsSync('.env')) {
  console.error('Missing .env')
  process.exit(1)
}

const env = {}
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const i = trimmed.indexOf('=')
  if (i === -1) continue
  const key = trimmed.slice(0, i).trim()
  let val = trimmed.slice(i + 1).trim()
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1)
  }
  env[key] = val
}

const KEYS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'OPENROUTER_API_KEY',
  'OPENROUTER_BASE_URL',
  'LLM_CHAT_MODELS',
  'LLM_PREDICTION_MODELS',
  'OPENAI_ASSISTANT_MAX_TOKENS',
  'EMBEDDING_MODEL',
  'OPENAI_API_KEY',
  'JWT_SECRET',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_APP_URL',
  'PLATFORM_ADMIN_EMAIL',
  'PLATFORM_ADMIN_PASSWORD',
  'AUTH_DEV_MODE',
]

const overrides = {
  NEXT_PUBLIC_APP_URL: 'https://cortex-gamma-teal.vercel.app',
  AUTH_DEV_MODE: 'false',
}

function addEnv(key, value, targets) {
  const tmp = join(tmpdir(), `vercel-env-${randomBytes(8).toString('hex')}.txt`)
  writeFileSync(tmp, value, 'utf8')
  try {
    // PowerShell: Get-Content -Raw | npx vercel env add ...
    const ps = `
      $ErrorActionPreference = 'Stop'
      $val = Get-Content -Raw -LiteralPath '${tmp.replace(/'/g, "''")}'
      $val | npx vercel env add ${key} ${targets} --yes --force --sensitive
      if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    `
    const result = spawnSync('powershell', ['-NoProfile', '-Command', ps], {
      encoding: 'utf8',
    })
    const out = `${result.stdout || ''}\n${result.stderr || ''}`
    const success = /Saved|Overrode|Added/i.test(out) && result.status === 0
    return {
      ok: success,
      detail: out.replace(/\s+/g, ' ').trim().slice(0, 280),
    }
  } finally {
    try {
      unlinkSync(tmp)
    } catch {
      /* ignore */
    }
  }
}

let ok = 0
let skipped = 0
let failed = 0

for (const key of KEYS) {
  const value = overrides[key] ?? env[key]
  if (value === undefined || value === '') {
    console.log(`skip ${key} (empty)`)
    skipped++
    continue
  }

  // Sensitive vars are only allowed on Production/Preview (not Development)
  const targets = ['production', 'preview']
  let allOk = true
  let lastDetail = ''
  for (const target of targets) {
    const result = addEnv(key, value, target)
    lastDetail = result.detail
    if (!result.ok) {
      allOk = false
      break
    }
  }

  if (allOk) {
    console.log(`ok   ${key}`)
    ok++
  } else {
    console.log(`fail ${key}: ${lastDetail}`)
    failed++
  }
}

console.log(`\nDone: ${ok} ok, ${skipped} skipped, ${failed} failed`)
if (failed > 0) process.exit(1)

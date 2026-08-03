import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const buckets = [
  process.env.NEXT_PUBLIC_SUPABASE_UPLOAD_BUCKET ?? 'uploads',
  process.env.NEXT_PUBLIC_SUPABASE_DOCUMENT_BUCKET ?? 'documents',
]

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: existing, error: listError } = await admin.storage.listBuckets()
if (listError) {
  console.error('Failed to list buckets:', listError.message)
  process.exit(1)
}

const names = new Set(existing?.map((b) => b.name) ?? [])

for (const bucket of buckets) {
  if (names.has(bucket)) {
    console.log(`✓ Bucket "${bucket}" already exists`)
    continue
  }

  const { error } = await admin.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
  })

  if (error) {
    console.error(`✗ Failed to create bucket "${bucket}":`, error.message)
    process.exit(1)
  }

  console.log(`✓ Created bucket "${bucket}"`)
}

console.log('Supabase storage buckets are ready.')

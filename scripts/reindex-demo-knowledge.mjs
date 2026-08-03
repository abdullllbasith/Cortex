/**
 * Re-index demo tenant with OpenRouter Nemotron 3 Embed 1B (free).
 * Uses DIRECT_URL + raw SQL to avoid Prisma pooler issues in CLI.
 *
 * Usage: node scripts/reindex-demo-knowledge.mjs
 */
import { readFileSync, existsSync } from 'fs'
import pg from 'pg'

if (existsSync('.env')) {
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
    if (!process.env[key]) process.env[key] = val
  }
}

const model = process.env.EMBEDDING_MODEL || 'nvidia/nemotron-3-embed-1b:free'
const apiKey = process.env.OPENROUTER_API_KEY
const baseUrl = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL

if (!apiKey || !dbUrl) {
  console.error('Need OPENROUTER_API_KEY and DIRECT_URL')
  process.exit(1)
}

async function embedBatch(texts) {
  const res = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://saios.softora.ai',
      'X-Title': 'SAIOS',
    },
    body: JSON.stringify({
      model,
      input: texts,
      encoding_format: 'float',
    }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error?.message || `Embedding HTTP ${res.status}`)
  }
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

function toVectorLiteral(vec) {
  return `[${vec.join(',')}]`
}

const client = new pg.Client({ connectionString: dbUrl })
await client.connect()

const tenantRes = await client.query(`SELECT id, slug FROM tenants WHERE slug = 'demo' LIMIT 1`)
const tenant = tenantRes.rows[0]
if (!tenant) {
  console.error('Demo tenant not found')
  process.exit(1)
}
console.log('Tenant', tenant.slug, tenant.id)
console.log('Model', model)

const jobs = [
  {
    table: 'products',
    sql: `SELECT id, name, catalog::text AS catalog, "supplierInfo"::text AS supplier FROM products WHERE "tenantId" = $1 AND "embeddingStatus"::text IN ('PENDING','ERROR','FAILED')`,
    content: (r) => `${r.name} ${r.catalog} ${r.supplier}`,
  },
  {
    table: 'customers',
    sql: `SELECT id, profile::text AS profile, preferences::text AS preferences, "purchaseHistory"::text AS history, "loyaltyData"::text AS loyalty FROM customers WHERE "tenantId" = $1 AND "embeddingStatus"::text IN ('PENDING','ERROR','FAILED')`,
    content: (r) => `${r.profile} ${r.preferences} ${r.history} ${r.loyalty}`,
  },
  {
    table: 'suppliers',
    sql: `SELECT id, name, "performanceScore", "reliabilityMetrics"::text AS metrics FROM suppliers WHERE "tenantId" = $1 AND "embeddingStatus"::text IN ('PENDING','ERROR','FAILED')`,
    content: (r) => `${r.name} score:${r.performanceScore} ${r.metrics}`,
  },
  {
    table: 'business_knowledge',
    sql: `SELECT id, type, title, content FROM business_knowledge WHERE "tenantId" = $1 AND "embeddingStatus"::text IN ('PENDING','ERROR','FAILED')`,
    content: (r) => `${r.type}: ${r.title}\n${r.content}`,
  },
  {
    table: 'crm_contacts',
    sql: `SELECT id, "firstName", "lastName", email, company, "jobTitle", notes, tags FROM crm_contacts WHERE "tenantId" = $1 AND "embeddingStatus"::text IN ('PENDING','ERROR','FAILED')`,
    content: (r) =>
      [r.firstName, r.lastName, r.email, r.company, r.jobTitle, r.notes, (r.tags || []).join(' ')]
        .filter(Boolean)
        .join(' '),
  },
]

try {
  for (const job of jobs) {
    const { rows } = await client.query(job.sql, [tenant.id])
    console.log(`${job.table}: ${rows.length} to index`)
    if (rows.length === 0) continue

    const batchSize = 16
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const texts = batch.map(job.content)
      const vectors = await embedBatch(texts)
      for (let j = 0; j < batch.length; j++) {
        const vec = vectors[j]
        if (!vec || vec.length !== 2048) {
          throw new Error(`Bad dims for ${job.table} ${batch[j].id}: ${vec?.length}`)
        }
        await client.query(
          `UPDATE "${job.table}"
           SET embedding = $1::vector,
               "embeddingStatus" = 'COMPLETED',
               "embeddingUpdatedAt" = NOW()
           WHERE id = $2`,
          [toVectorLiteral(vec), batch[j].id],
        )
      }
      console.log(`  indexed ${Math.min(i + batchSize, rows.length)}/${rows.length}`)
    }
  }
  console.log('Done')
} finally {
  await client.end()
}

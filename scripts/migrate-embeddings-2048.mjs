/**
 * Migrate pgvector columns from 1536 → 2048 for Nemotron 3 Embed 1B (free).
 * Drops HNSW/IVFFlat indexes first (pgvector caps those at 2000 dims).
 *
 * Usage: node scripts/migrate-embeddings-2048.mjs
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

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) {
  console.error('Missing DIRECT_URL / DATABASE_URL')
  process.exit(1)
}

const tables = ['customers', 'products', 'suppliers', 'business_knowledge', 'crm_contacts']
const client = new pg.Client({ connectionString: url })
await client.connect()

try {
  await client.query('CREATE EXTENSION IF NOT EXISTS vector')

  const indexes = await client.query(`
    SELECT schemaname, indexname, tablename, indexdef
    FROM pg_indexes
    WHERE indexdef ILIKE '%embedding%'
      AND tablename = ANY($1::text[])
    ORDER BY tablename, indexname
  `, [tables])

  for (const row of indexes.rows) {
    const isAnn = /USING (hnsw|ivfflat)/i.test(row.indexdef)
    if (!isAnn) continue
    console.log(`Dropping ANN index ${row.indexname} on ${row.tablename}`)
    await client.query(`DROP INDEX IF EXISTS "${row.schemaname}"."${row.indexname}"`)
  }

  for (const table of tables) {
    console.log(`Migrating ${table}.embedding → vector(2048)...`)
    await client.query(`
      ALTER TABLE "${table}"
      ALTER COLUMN embedding TYPE vector(2048)
      USING NULL
    `)
    await client.query(`
      UPDATE "${table}"
      SET
        "embeddingStatus" = 'PENDING',
        "embeddingContentHash" = NULL,
        "embeddingUpdatedAt" = NULL
    `)
    console.log(`  OK — statuses reset to PENDING`)
  }

  console.log('Done. Re-index knowledge via POST /api/knowledge/index')
  console.log('Note: HNSW/IVFFlat indexes were dropped (pgvector max 2000 dims for those).')
  console.log('Demo-scale exact cosine search still works without ANN indexes.')
} finally {
  await client.end()
}

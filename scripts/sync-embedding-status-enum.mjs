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

const client = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL })
await client.connect()

for (const label of ['INDEXED', 'ERROR']) {
  const exists = await client.query(
    `SELECT 1 FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'EmbeddingStatus' AND e.enumlabel = $1`,
    [label],
  )
  if (exists.rowCount === 0) {
    await client.query(`ALTER TYPE "EmbeddingStatus" ADD VALUE '${label}'`)
    console.log('Added', label)
  } else {
    console.log('Exists', label)
  }
}

const r = await client.query(`
  SELECT e.enumlabel FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE t.typname = 'EmbeddingStatus'
  ORDER BY e.enumsortorder
`)
console.log('Enum values:', r.rows.map((x) => x.enumlabel).join(', '))
await client.end()

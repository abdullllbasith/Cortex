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
const tid = 'cmqlcckyn0000u0u7ov2ij14j'

const byDay = await client.query(
  `
  SELECT date_trunc('day', timestamp) AS d,
         count(*)::int AS n,
         coalesce(sum(revenue), 0)::float AS rev
  FROM sales_events
  WHERE "tenantId" = $1
  GROUP BY 1
  ORDER BY 1 DESC
  LIMIT 20
  `,
  [tid],
)
console.log('latest sales_events by day:')
for (const row of byDay.rows) {
  console.log((row.d?.toISOString?.() ?? row.d), 'n=' + row.n, 'rev=' + row.rev)
}

const tot = await client.query(
  `SELECT count(*)::int AS n, min(timestamp) AS min_ts, max(timestamp) AS max_ts
   FROM sales_events WHERE "tenantId" = $1`,
  [tid],
)
console.log('total', tot.rows[0])
console.log('now', new Date().toISOString())

const last14 = await client.query(
  `
  SELECT coalesce(sum(revenue),0)::float AS rev, count(*)::int AS n
  FROM sales_events
  WHERE "tenantId" = $1
    AND timestamp >= NOW() - INTERVAL '14 days'
  `,
  [tid],
)
console.log('last 14 days (DB NOW)', last14.rows[0])

await client.end()

/**
 * Rebuild demo sales_events into a clean UTC-relative 90-day window.
 * Usage: node scripts/refresh-demo-sales.mjs
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

function id() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 11)}`
}

const client = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL })
await client.connect()

const tenant = await client.query(`SELECT id FROM tenants WHERE slug = 'demo' LIMIT 1`)
const tid = tenant.rows[0]?.id
if (!tid) {
  console.error('Demo tenant not found')
  process.exit(1)
}

const products = (
  await client.query(
    `SELECT id FROM products WHERE "tenantId" = $1 ORDER BY "createdAt" ASC LIMIT 3`,
    [tid],
  )
).rows
const customers = (
  await client.query(
    `SELECT id FROM customers WHERE "tenantId" = $1 ORDER BY "createdAt" ASC LIMIT 3`,
    [tid],
  )
).rows

if (!products.length || !customers.length) {
  console.error('Need products + customers on demo tenant')
  process.exit(1)
}

await client.query(`DELETE FROM sales_events WHERE "tenantId" = $1`, [tid])
await client.query(`DELETE FROM inventory_events WHERE "tenantId" = $1`, [tid])
await client.query(`DELETE FROM analytics_snapshots WHERE "tenantId" = $1`, [tid]).catch(() => {})

const channels = ['online', 'retail', 'wholesale', 'direct']
const branches = ['HQ', 'North', 'South', 'West']
const now = new Date()
let inserted = 0

for (let day = 0; day < 90; day++) {
  for (let i = 0; i < 3; i++) {
    const product = products[i % products.length]
    const customer = customers[i % customers.length]
    const qty = 1 + ((day + i) % 5)
    const unitPrice = 500 + i * 300 + (day % 7) * 50
    const revenue = qty * unitPrice
    const cost = revenue * (0.55 + i * 0.05)
    const ts = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - day,
        10 + i,
        (day * 7) % 60,
        0,
      ),
    )
    // Write UTC wall-clock into timestamp-without-time-zone column.
    const naive = ts.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')

    await client.query(
      `INSERT INTO sales_events
        (id, "tenantId", "productId", "customerId", quantity, revenue, cost, margin, channel, "branchId", timestamp, "createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamp, NOW())`,
      [
        id(),
        tid,
        product.id,
        customer.id,
        qty,
        revenue,
        cost,
        revenue - cost,
        channels[(day + i) % channels.length],
        branches[(day + i) % branches.length],
        naive,
      ],
    )
    inserted++
  }
}

const check = await client.query(
  `
  SELECT count(*)::int AS n,
         max(timestamp)::text AS max_ts,
         min(timestamp)::text AS min_ts,
         coalesce(sum(CASE WHEN timestamp >= date_trunc('day', timezone('UTC', now()))
           THEN revenue ELSE 0 END), 0)::float AS today_rev,
         coalesce(sum(CASE WHEN timestamp >= timezone('UTC', now()) - interval '14 days'
           THEN revenue ELSE 0 END), 0)::float AS rev14
  FROM sales_events
  WHERE "tenantId" = $1
  `,
  [tid],
)
console.log('Inserted', inserted, 'sales events')
console.log(check.rows[0])
await client.end()

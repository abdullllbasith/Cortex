/**
 * Diagnose demo account data in the database.
 * Usage: node scripts/check-demo-tenant.mjs [email]
 */
import { readFileSync, existsSync } from 'fs'
import pg from 'pg'

function loadEnv() {
  if (!existsSync('.env')) return
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i === -1) continue
    const key = trimmed.slice(0, i).trim()
    let val = trimmed.slice(i + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const email = (process.argv[2] ?? 'demo@saios.app').trim().toLowerCase()
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL

if (!connectionString) {
  console.error('DATABASE_URL / DIRECT_URL not set in .env')
  process.exit(1)
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
})

try {
  const userRes = await pool.query(
    `SELECT u.id, u.email, u."supabaseId", u.role, u."tenantId", t.slug, t.name
     FROM users u
     JOIN tenants t ON t.id = u."tenantId"
     WHERE lower(u.email) = $1`,
    [email],
  )

  if (userRes.rows.length === 0) {
    console.error(`No User row for ${email}. Register on /register first.`)
    process.exit(1)
  }

  for (const row of userRes.rows) {
    console.log('\n=== App user ===')
    console.log(row)

    const counts = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM sales_events WHERE "tenantId" = $1) AS sales_events,
         (SELECT COUNT(*)::int FROM sales_orders WHERE "tenantId" = $1) AS sales_orders,
         (SELECT COUNT(*)::int FROM customers WHERE "tenantId" = $1) AS customers,
         (SELECT COUNT(*)::int FROM products WHERE "tenantId" = $1) AS products,
         (SELECT COUNT(*)::int FROM crm_deals WHERE "tenantId" = $1) AS crm_deals,
         (SELECT COUNT(*)::int FROM employees WHERE "tenantId" = $1) AS employees`,
      [row.tenantId],
    )
    console.log('\n=== Data counts for tenant ===')
    console.log(counts.rows[0])
  }

  const authRes = await pool.query(
    `SELECT id, email, email_confirmed_at IS NOT NULL AS confirmed
     FROM auth.users WHERE lower(email) = $1`,
    [email],
  )
  console.log('\n=== Supabase auth.users ===')
  if (authRes.rows.length === 0) {
    console.log('(no auth.users row — check Supabase Auth dashboard)')
  } else {
    for (const a of authRes.rows) {
      console.log(a)
      const app = userRes.rows[0]
      if (app && app.supabaseId !== a.id) {
        console.warn(`⚠ supabaseId mismatch: users table=${app.supabaseId} auth=${a.id}`)
      }
    }
  }
} finally {
  await pool.end()
}

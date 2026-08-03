/**
 * Test production login + dashboard API for demo user.
 * Usage: node scripts/test-prod-dashboard.mjs [baseUrl]
 */
import { readFileSync, existsSync } from 'fs'

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

const baseUrl = (process.argv[2] ?? 'https://softora-enterprise-ai-operating-sys-nine.vercel.app').replace(/\/$/, '')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const email = 'demo@saios.app'
const password = 'Demo@SAIOS2026'

if (!supabaseUrl || !anonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY in .env')
  process.exit(1)
}

console.log('Testing', baseUrl)

const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: {
    apikey: anonKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password }),
})

const authJson = await authRes.json()
if (!authRes.ok) {
  console.error('Supabase login failed:', authJson)
  process.exit(1)
}

const accessToken = authJson.access_token
console.log('Supabase login OK')

const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ supabaseAccessToken: accessToken, rememberMe: true }),
})

const sessionJson = await sessionRes.json()
console.log('Session status:', sessionRes.status)
if (!sessionRes.ok || !sessionJson.success) {
  console.error('Session bootstrap failed:', sessionJson)
  process.exit(1)
}

const { tenant, user, accessToken: jwt } = sessionJson.data
console.log('App user:', user.email, 'tenant:', tenant.slug, tenant.id)

const dashRes = await fetch(`${baseUrl}/api/analytics/dashboard`, {
  headers: {
    Authorization: `Bearer ${jwt}`,
    'x-tenant-id': tenant.id,
    Accept: 'application/json',
  },
})

const dashJson = await dashRes.json()
console.log('Dashboard status:', dashRes.status)
console.log('Dashboard success:', dashJson.success)
if (dashJson.success) {
  console.log('KPIs:', dashJson.data?.kpis)
  console.log('Pipeline stages:', dashJson.data?.pipelineByStage?.length)
  const chart = dashJson.data?.revenueChart14d ?? []
  console.log('Revenue 14d points:', chart.length)
  const chartSum = chart.reduce((s, p) => s + (Number(p.revenue) || 0), 0)
  console.log('Revenue 14d sum:', chartSum)
  console.log('Revenue 14d sample:', chart.slice(-5))
} else {
  console.error('Dashboard error:', dashJson.error)
}

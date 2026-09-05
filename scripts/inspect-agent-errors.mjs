/**
 * Inspect today's agent failures via pg (no Prisma adapter).
 * Usage: node scripts/inspect-agent-errors.mjs
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

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Missing DATABASE_URL')
  process.exit(1)
}

const useSsl = url.includes('supabase.com') || /sslmode=(require|verify-full)/i.test(url)
const pool = new pg.Pool({
  connectionString: url,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
})

const since = new Date()
since.setHours(0, 0, 0, 0)

const { rows: logs } = await pool.query(
  `SELECT "agentType", action, status, result, "createdAt"
   FROM agent_logs
   WHERE "createdAt" >= $1
   ORDER BY "createdAt" DESC
   LIMIT 60`,
  [since],
)

const failures = logs.filter((l) => l.status === 'FAILURE')
console.log('Today logs:', logs.length, 'failures:', failures.length)
console.log('--- Latest per agent ---')
for (const type of ['FINANCE', 'SALES', 'INVENTORY', 'OPERATIONS', 'EXECUTIVE']) {
  const latest = logs.find((l) => l.agentType === type)
  console.log(
    type,
    latest
      ? `${latest.status} ${latest.action} @ ${new Date(latest.createdAt).toISOString()}`
      : 'none',
  )
}
console.log('--- Failures ---')
for (const f of failures.slice(0, 25)) {
  console.log(
    JSON.stringify({
      agentType: f.agentType,
      action: f.action,
      at: new Date(f.createdAt).toISOString(),
      result: f.result,
    }),
  )
}

const { rows: tasks } = await pool.query(
  `SELECT "agentType", task, status, error, "createdAt"
   FROM agent_tasks
   WHERE "createdAt" >= $1
   ORDER BY "createdAt" DESC
   LIMIT 25`,
  [since],
)
console.log('--- Tasks ---')
for (const t of tasks) {
  console.log(
    JSON.stringify({
      agentType: t.agentType,
      status: t.status,
      task: String(t.task).slice(0, 100),
      error: t.error,
      at: new Date(t.createdAt).toISOString(),
    }),
  )
}

await pool.end()

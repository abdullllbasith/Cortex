import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const connectionString =
  process.env.CHECK_DATABASE_URL ?? process.env.DATABASE_URL ?? process.env.DIRECT_URL

if (!connectionString) {
  console.error('DB check failed: DATABASE_URL is not set')
  process.exitCode = 1
  process.exit(1)
}

const url = new URL(connectionString.replace(/^postgresql:/, 'http:'))
const useSsl =
  url.hostname.includes('supabase.com') ||
  /sslmode=(require|verify-full|prefer)/i.test(connectionString)

const pool = new Pool({
  host: url.hostname,
  port: Number(url.port || 5432),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, '') || 'postgres',
  connectionTimeoutMillis: 120_000,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
})

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const email = (process.argv[2] ?? 'ab.unireg@gmail.com').trim().toLowerCase()

try {
  await prisma.$queryRaw`SELECT 1 AS ok`
  const count = await prisma.user.count()
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true, isActive: true, supabaseId: true, tenant: { select: { slug: true } } },
  })
  console.log(JSON.stringify({ userCount: count, user }, null, 2))
} catch (err) {
  console.error('DB check failed:', err.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
  await pool.end()
}

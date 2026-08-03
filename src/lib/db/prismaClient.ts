import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool, type PoolConfig } from 'pg'

type GlobalPrisma = typeof globalThis & {
  __prisma?: PrismaClient
  __prismaPool?: Pool
  /** Bumps when `prisma generate` changes scalar fields — avoids stale singleton in dev */
  __prismaClientHash?: string
}

const globalForPrisma = globalThis as GlobalPrisma

const CLIENT_HASH = Object.values(Prisma.TenantScalarFieldEnum).sort().join(',')

function buildPgPoolConfig(connectionString: string): PoolConfig {
  const url = new URL(connectionString.replace(/^postgresql:/, 'http:'))
  const useSsl =
    url.hostname.includes('supabase.com') ||
    /sslmode=(require|verify-full|prefer)/i.test(connectionString)

  const maxConnections = Number(url.searchParams.get('connection_limit') ?? 10)

  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'postgres',
    max: Number.isFinite(maxConnections) && maxConnections > 0 ? maxConnections : 10,
    connectionTimeoutMillis: process.env.NODE_ENV === 'development' ? 120_000 : 30_000,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  }
}

function createPgPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }

  return new Pool(buildPgPoolConfig(connectionString))
}

function createPrismaClient() {
  const pool = globalForPrisma.__prismaPool ?? createPgPool()
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__prismaPool = pool
  }

  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

if (process.env.NODE_ENV !== 'production' && globalForPrisma.__prismaClientHash !== CLIENT_HASH) {
  void globalForPrisma.__prisma?.$disconnect().catch(() => {})
  void globalForPrisma.__prismaPool?.end().catch(() => {})
  globalForPrisma.__prisma = undefined
  globalForPrisma.__prismaPool = undefined
  globalForPrisma.__prismaClientHash = CLIENT_HASH
}

export const prisma = globalForPrisma.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma
}

export default prisma

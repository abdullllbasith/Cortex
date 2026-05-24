import { PrismaClient, Prisma } from '@prisma/client'

type GlobalPrisma = typeof globalThis & {
  __prisma?: PrismaClient
  /** Bumps when `prisma generate` changes scalar fields — avoids stale singleton in dev */
  __prismaClientHash?: string
}

const globalForPrisma = globalThis as GlobalPrisma

const CLIENT_HASH = Object.values(Prisma.TenantScalarFieldEnum).sort().join(',')

if (process.env.NODE_ENV !== 'production' && globalForPrisma.__prismaClientHash !== CLIENT_HASH) {
  void globalForPrisma.__prisma?.$disconnect().catch(() => {})
  globalForPrisma.__prisma = undefined
  globalForPrisma.__prismaClientHash = CLIENT_HASH
}

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma
}

export default prisma

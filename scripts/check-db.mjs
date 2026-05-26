import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.CHECK_DATABASE_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    },
  },
})

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
}

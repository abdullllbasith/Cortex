import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [tenants, customers, salesEvents, products] = await Promise.all([
    prisma.tenant.count(),
    prisma.customer.count(),
    prisma.salesEvent.count(),
    prisma.product.count(),
  ])
  const sample = await prisma.tenant.findFirst({ where: { slug: 'acme-corp' }, select: { id: true, name: true } })
  console.log(JSON.stringify({ sample, counts: { tenants, customers, salesEvents, products } }, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

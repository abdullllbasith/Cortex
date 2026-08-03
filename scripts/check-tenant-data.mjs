import prisma from '../src/lib/db/prisma.ts'

const email = process.argv[2] ?? 'ab.unireg@gmail.com'

const user = await prisma.user.findFirst({
  where: { email, isActive: true },
  include: { tenant: true },
})

if (!user) {
  console.log('NO USER')
  process.exit(1)
}

const tid = user.tenantId
console.log('User:', user.email)
console.log('Tenant:', user.tenant.slug, tid)

const counts = {
  salesEvent: await prisma.salesEvent.count({ where: { tenantId: tid } }),
  salesOrder: await prisma.salesOrder.count({ where: { tenantId: tid } }),
  customer: await prisma.customer.count({ where: { tenantId: tid } }),
  product: await prisma.product.count({ where: { tenantId: tid } }),
  crmDeal: await prisma.crmDeal.count({ where: { tenantId: tid } }),
  invoice: await prisma.invoice.count({ where: { tenantId: tid } }),
  crmContact: await prisma.crmContact.count({ where: { tenantId: tid } }),
}

console.log(JSON.stringify(counts, null, 2))

const recent = await prisma.salesEvent.findMany({
  where: { tenantId: tid },
  orderBy: { timestamp: 'desc' },
  take: 3,
  select: { revenue: true, timestamp: true },
})
console.log('Recent sales events:', recent)

await prisma.$disconnect()

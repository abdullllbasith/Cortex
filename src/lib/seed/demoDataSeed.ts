import { createHash } from 'crypto'
import { BusinessKnowledgeType, Prisma } from '@prisma/client'
import prisma from '@/lib/db/prismaClient'

function hash(content: string) {
  return createHash('sha256').update(content).digest('hex')
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export interface DemoSeedResult {
  seeded: boolean
  reason?: string
  salesEvents: number
  customers: number
  products: number
}

export async function seedDemoDataForTenant(
  tenantId: string,
  options?: { force?: boolean },
): Promise<DemoSeedResult> {
  const existingSales = await prisma.salesEvent.count({ where: { tenantId } })
  if (existingSales > 0 && !options?.force) {
    return {
      seeded: false,
      reason: 'already_has_data',
      salesEvents: existingSales,
      customers: await prisma.customer.count({ where: { tenantId } }),
      products: await prisma.product.count({ where: { tenantId } }),
    }
  }

  if (options?.force && existingSales > 0) {
    await prisma.$transaction([
      prisma.salesEvent.deleteMany({ where: { tenantId } }),
      prisma.inventoryEvent.deleteMany({ where: { tenantId } }),
      prisma.customerEvent.deleteMany({ where: { tenantId } }),
      prisma.supplierEvent.deleteMany({ where: { tenantId } }),
      prisma.analyticsSnapshot.deleteMany({ where: { tenantId } }),
    ])
  }

  let customers = await prisma.customer.findMany({ where: { tenantId }, take: 3 })
  if (customers.length === 0) {
    const seedCustomers = [
      {
        profile: { name: 'Sarah Chen', email: 'sarah.chen@demo.local', company: 'Northwind Traders', tier: 'Gold' },
        purchaseHistory: [{ orderId: 'ORD-1001', amount: 12400, date: '2025-11-15', items: 3 }],
        preferences: { channel: 'email' },
        communicationHistory: [{ type: 'email', subject: 'Q4 renewal', date: '2025-12-01' }],
        loyaltyData: { points: 8420, tier: 'Gold' },
      },
      {
        profile: { name: 'Marcus Johnson', email: 'marcus@demo.local', company: 'Contoso Ltd', tier: 'Silver' },
        purchaseHistory: [{ orderId: 'ORD-2044', amount: 3200, date: '2025-10-22', items: 1 }],
        preferences: { channel: 'phone' },
        communicationHistory: [{ type: 'call', subject: 'Support', date: '2025-11-28' }],
        loyaltyData: { points: 2100, tier: 'Silver' },
      },
      {
        profile: { name: 'Elena Rodriguez', email: 'elena@demo.local', company: 'Fabrikam Inc', tier: 'Platinum' },
        purchaseHistory: [{ orderId: 'ORD-3099', amount: 45800, date: '2025-12-10', items: 12 }],
        preferences: { channel: 'slack' },
        communicationHistory: [{ type: 'meeting', subject: 'Annual review', date: '2025-12-15' }],
        loyaltyData: { points: 24500, tier: 'Platinum' },
      },
    ]

    for (const c of seedCustomers) {
      const content = JSON.stringify(c)
      const created = await prisma.customer.create({
        data: {
          tenantId,
          ...c,
          profile: c.profile as Prisma.InputJsonValue,
          purchaseHistory: c.purchaseHistory as Prisma.InputJsonValue,
          preferences: c.preferences as Prisma.InputJsonValue,
          communicationHistory: c.communicationHistory as Prisma.InputJsonValue,
          loyaltyData: c.loyaltyData as Prisma.InputJsonValue,
          embeddingContentHash: hash(content),
        },
      })
      customers.push(created)
    }
  }

  let products = await prisma.product.findMany({ where: { tenantId }, take: 3 })
  if (products.length === 0) {
    const seedProducts = [
      { name: 'Enterprise Analytics Suite', sku: 'EAS-001', catalog: { sku: 'EAS-001', category: 'Software' }, inventoryLevel: 999 },
      { name: 'Industrial Sensor Kit', sku: 'ISK-200', catalog: { sku: 'ISK-200', category: 'Hardware' }, inventoryLevel: 18 },
      { name: 'Cloud Storage Pro 10TB', sku: 'CSP-10T', catalog: { sku: 'CSP-10T', category: 'Infrastructure' }, inventoryLevel: 500 },
    ]

    for (const [index, p] of seedProducts.entries()) {
      const content = `${p.name} ${JSON.stringify(p.catalog)}`
      const created = await prisma.product.create({
        data: {
          tenantId,
          name: p.name,
          sku: p.sku,
          slug: `${slugify(p.name)}-${index + 1}`,
          catalog: p.catalog as Prisma.InputJsonValue,
          inventoryLevel: p.inventoryLevel,
          supplierInfo: { primarySupplier: 'Demo Supplier' } as Prisma.InputJsonValue,
          pricingHistory: [{ price: 499 + index * 400, effectiveDate: '2025-01-01' }] as Prisma.InputJsonValue,
          embeddingContentHash: hash(content),
        },
      })
      products.push(created)
    }
  } else if (products[0]) {
    await prisma.product.update({
      where: { id: products[0].id },
      data: { inventoryLevel: 18 },
    })
  }

  let suppliers = await prisma.supplier.findMany({ where: { tenantId }, take: 2 })
  if (suppliers.length === 0) {
    const seedSuppliers = [
      { name: 'TechParts Co', performanceScore: 92.5 },
      { name: 'SensorWorks', performanceScore: 87.0 },
    ]
    for (const s of seedSuppliers) {
      const created = await prisma.supplier.create({
        data: {
          tenantId,
          name: s.name,
          performanceScore: s.performanceScore,
          deliveryHistory: [{ month: '2025-11', onTimeRate: 0.96 }] as Prisma.InputJsonValue,
          reliabilityMetrics: { defectRate: 0.02, avgLeadTimeDays: 5 } as Prisma.InputJsonValue,
          costTrends: [{ quarter: 'Q4-2025', avgCostChange: -0.03 }] as Prisma.InputJsonValue,
          embeddingContentHash: hash(`${s.name}:${s.performanceScore}`),
        },
      })
      suppliers.push(created)
    }
  }

  const docs = await prisma.businessKnowledge.count({ where: { tenantId } })
  if (docs === 0) {
    await prisma.businessKnowledge.create({
      data: {
        tenantId,
        type: BusinessKnowledgeType.REPORT,
        title: 'Demo Sales Summary',
        content: 'Sample revenue and order history seeded for dashboard preview.',
        metadata: { source: 'demo-seed' } as Prisma.InputJsonValue,
        embeddingContentHash: hash('demo-sales-summary'),
      },
    })
  }

  const channels = ['online', 'retail', 'wholesale', 'direct']
  const branches = ['HQ', 'North', 'South', 'West']

  for (let day = 0; day < 90; day++) {
    const ts = new Date()
    ts.setDate(ts.getDate() - day)
    ts.setHours(9 + (day % 10), day % 60, 0, 0)

    for (let i = 0; i < 3; i++) {
      const product = products[i % products.length]
      const customer = customers[i % customers.length]
      if (!product || !customer) continue

      const qty = 1 + ((day + i) % 5)
      const unitPrice = 500 + i * 300 + (day % 7) * 50
      const revenue = qty * unitPrice
      const cost = revenue * (0.55 + i * 0.05)

      await prisma.salesEvent.create({
        data: {
          tenantId,
          productId: product.id,
          customerId: customer.id,
          quantity: qty,
          revenue,
          cost,
          margin: revenue - cost,
          channel: channels[(day + i) % channels.length]!,
          branchId: branches[(day + i) % branches.length]!,
          timestamp: ts,
        },
      })

      await prisma.inventoryEvent.create({
        data: {
          tenantId,
          productId: product.id,
          type: i === 0 ? 'SALE' : i === 1 ? 'RESTOCK' : 'ADJUSTMENT',
          quantity: i === 0 ? -qty : qty * 2,
          timestamp: ts,
        },
      })
    }

    if (day % 7 === 0 && customers[0]) {
      await prisma.customerEvent.create({
        data: {
          tenantId,
          customerId: customers[0].id,
          type: day % 14 === 0 ? 'CHURN' : 'PURCHASE',
          metadata: { source: 'demo-seed', orderValue: 1200 + day * 10 } as Prisma.InputJsonValue,
          timestamp: ts,
        },
      })
    }

    if (day % 5 === 0 && suppliers[0]) {
      await prisma.supplierEvent.create({
        data: {
          tenantId,
          supplierId: suppliers[day % suppliers.length]!.id,
          type: day % 10 === 0 ? 'DELAY' : 'DELIVERY',
          metadata: { cost: 800 + day * 5, daysLate: day % 10 === 0 ? 3 : 0 } as Prisma.InputJsonValue,
          timestamp: ts,
        },
      })
    }
  }

  await prisma.analyticsSnapshot.deleteMany({ where: { tenantId } })

  const salesEvents = await prisma.salesEvent.count({ where: { tenantId } })

  return {
    seeded: true,
    salesEvents,
    customers: customers.length,
    products: products.length,
  }
}

async function main() {
  const slug = process.argv[2]
  const tenant = slug
    ? await prisma.tenant.findFirst({ where: { slug } })
    : await prisma.tenant.findFirst({ orderBy: { createdAt: 'desc' } })

  if (!tenant) {
    console.error('No tenant found')
    process.exit(1)
  }

  const result = await seedDemoDataForTenant(tenant.id, { force: process.argv.includes('--force') })
  console.log(`Demo seed for ${tenant.name} (${tenant.slug}):`, result)
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}

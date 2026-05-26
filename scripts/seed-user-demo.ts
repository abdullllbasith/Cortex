/**
 * Seed full demo data for a specific user account (by email).
 * Usage: npm run db:seed:user
 *        npm run db:seed:user -- someone@example.com
 */
import { BusinessKnowledgeType } from '@prisma/client'
import { createHash } from 'crypto'
import prisma from '../src/lib/db/prisma'
import { seedPipelinesForTenant } from '../src/lib/crm/pipelineService'
import { seedCrmEventWorkflowsForTenant } from '../src/lib/crm/crmWorkflowSeed'
import { seedCrossModuleWorkflowsForTenant } from '../src/lib/workflows/crossModuleWorkflowSeed'
import { seedDefaultAccounts } from '../src/lib/finance/chartOfAccountsService'
import {
  seedCrmContactsForTenant,
  seedDashboardActivity,
  seedHrForTenant,
} from '../prisma/seedHr'
import { seedDashboardDemoData } from '../prisma/seedDashboardDemo'

const DEFAULT_EMAIL = 'ab.unireg@gmail.com'

function hash(content: string) {
  return createHash('sha256').update(content).digest('hex')
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function ensureDatabaseReady() {
  await prisma.$queryRaw`SELECT 1`
}

async function seedDemoDataForTenant(tenantId: string, ownerId: string, tenantSlug: string) {
  await seedPipelinesForTenant(tenantId)
  await seedDefaultAccounts(tenantId, { currency: 'USD' })
  await seedCrmContactsForTenant(prisma, tenantId, ownerId)
  await seedCrmEventWorkflowsForTenant(tenantId, ownerId)
  await seedCrossModuleWorkflowsForTenant(tenantId, ownerId)
  await seedHrForTenant(prisma, tenantId, ownerId, tenantSlug)
  await seedDashboardActivity(prisma, tenantId, ownerId)
  await seedDashboardDemoData(prisma, tenantId, ownerId)

  const customerCount = await prisma.customer.count({ where: { tenantId } })
  if (customerCount === 0) {
    const customers = [
      {
        profile: { name: 'Sarah Chen', email: 'sarah.chen@northwind.com', company: 'Northwind Traders', tier: 'Gold', region: 'APAC' },
        purchaseHistory: [{ orderId: 'ORD-1001', amount: 12400, date: '2025-11-15', items: 3 }],
        preferences: { channel: 'email', newsletter: true, categories: ['electronics', 'office'] },
        communicationHistory: [{ type: 'email', subject: 'Q4 renewal', date: '2025-12-01' }],
        loyaltyData: { points: 8420, tier: 'Gold', memberSince: '2022-03-10' },
      },
      {
        profile: { name: 'Marcus Johnson', email: 'marcus@contoso.com', company: 'Contoso Ltd', tier: 'Silver', region: 'NA' },
        purchaseHistory: [{ orderId: 'ORD-2044', amount: 3200, date: '2025-10-22', items: 1 }],
        preferences: { channel: 'phone', newsletter: false, categories: ['industrial'] },
        communicationHistory: [{ type: 'call', subject: 'Support escalation', date: '2025-11-28' }],
        loyaltyData: { points: 2100, tier: 'Silver', memberSince: '2024-01-05' },
      },
      {
        profile: { name: 'Elena Rodriguez', email: 'elena@fabrikam.io', company: 'Fabrikam Inc', tier: 'Platinum', region: 'EMEA' },
        purchaseHistory: [{ orderId: 'ORD-3099', amount: 45800, date: '2025-12-10', items: 12 }],
        preferences: { channel: 'slack', newsletter: true, categories: ['enterprise', 'cloud'] },
        communicationHistory: [{ type: 'meeting', subject: 'Annual review', date: '2025-12-15' }],
        loyaltyData: { points: 24500, tier: 'Platinum', memberSince: '2019-07-20' },
      },
    ]
    for (const c of customers) {
      await prisma.customer.create({
        data: {
          tenantId,
          ...c,
          embeddingContentHash: hash(JSON.stringify(c)),
        },
      })
    }
    console.log('  ✓ Customers')
  } else {
    console.log('  ✓ Customers (already present)')
  }

  const products = [
    { name: 'Enterprise Analytics Suite', catalog: { sku: 'EAS-001', category: 'Software', description: 'AI-powered analytics platform' }, inventoryLevel: 999, supplierInfo: { primarySupplier: 'TechParts Co' }, pricingHistory: [{ price: 4999, effectiveDate: '2025-01-01' }] },
    { name: 'Industrial Sensor Kit', catalog: { sku: 'ISK-200', category: 'Hardware', description: 'IoT sensor bundle for manufacturing' }, inventoryLevel: 142, supplierInfo: { primarySupplier: 'SensorWorks' }, pricingHistory: [{ price: 899, effectiveDate: '2025-06-01' }] },
    { name: 'Cloud Storage Pro 10TB', catalog: { sku: 'CSP-10T', category: 'Infrastructure', description: 'Managed cloud storage tier' }, inventoryLevel: 500, supplierInfo: { primarySupplier: 'CloudBase Inc' }, pricingHistory: [{ price: 299, effectiveDate: '2025-03-15' }] },
  ]

  for (const p of products) {
    const content = `${p.name} ${JSON.stringify(p.catalog)}`
    const sku = p.catalog.sku
    const sellingPrice = p.pricingHistory[0]?.price ?? 0
    await prisma.product.upsert({
      where: { tenantId_sku: { tenantId, sku } },
      update: {
        name: p.name,
        description: p.catalog.description,
        catalog: p.catalog,
        inventoryLevel: p.inventoryLevel,
        supplierInfo: p.supplierInfo,
        pricingHistory: p.pricingHistory,
        sellingPrice,
        costPrice: Math.round(sellingPrice * 0.6 * 100) / 100,
        embeddingContentHash: hash(content),
      },
      create: {
        tenantId,
        sku,
        slug: slugify(p.name),
        name: p.name,
        description: p.catalog.description,
        catalog: p.catalog,
        inventoryLevel: p.inventoryLevel,
        supplierInfo: p.supplierInfo,
        pricingHistory: p.pricingHistory,
        sellingPrice,
        costPrice: Math.round(sellingPrice * 0.6 * 100) / 100,
        embeddingContentHash: hash(content),
      },
    })
  }
  console.log('  ✓ Products')

  const suppliers = [
    { name: 'TechParts Co', performanceScore: 92.5, deliveryHistory: [{ month: '2025-11', onTimeRate: 0.96 }], reliabilityMetrics: { defectRate: 0.02, avgLeadTimeDays: 5 }, costTrends: [{ quarter: 'Q4-2025', avgCostChange: -0.03 }] },
    { name: 'SensorWorks', performanceScore: 87.0, deliveryHistory: [{ month: '2025-11', onTimeRate: 0.89 }], reliabilityMetrics: { defectRate: 0.05, avgLeadTimeDays: 12 }, costTrends: [{ quarter: 'Q4-2025', avgCostChange: 0.07 }] },
    { name: 'CloudBase Inc', performanceScore: 98.2, deliveryHistory: [{ month: '2025-11', onTimeRate: 0.99 }], reliabilityMetrics: { defectRate: 0.001, avgLeadTimeDays: 1 }, costTrends: [{ quarter: 'Q4-2025', avgCostChange: -0.01 }] },
  ]

  for (const s of suppliers) {
    const content = `${s.name} score:${s.performanceScore}`
    const code = slugify(s.name).toUpperCase().replace(/-/g, '_') || 'SUPPLIER'
    await prisma.supplier.upsert({
      where: { tenantId_code: { tenantId, code } },
      update: {
        name: s.name,
        performanceScore: s.performanceScore,
        deliveryHistory: s.deliveryHistory,
        reliabilityMetrics: s.reliabilityMetrics,
        costTrends: s.costTrends,
        embeddingContentHash: hash(content),
      },
      create: {
        tenantId,
        code,
        name: s.name,
        performanceScore: s.performanceScore,
        deliveryHistory: s.deliveryHistory,
        reliabilityMetrics: s.reliabilityMetrics,
        costTrends: s.costTrends,
        embeddingContentHash: hash(content),
      },
    })
  }
  console.log('  ✓ Suppliers')

  const knowledgeCount = await prisma.businessKnowledge.count({ where: { tenantId } })
  if (knowledgeCount === 0) {
    const docs = [
      { type: BusinessKnowledgeType.POLICY, title: 'Data Retention Policy', content: 'All customer data must be retained for 7 years per GDPR compliance.', metadata: { department: 'Legal', version: '2.1' } },
      { type: BusinessKnowledgeType.SOP, title: 'Order Fulfillment SOP', content: 'Validate inventory, pick, QC, ship within 24 hours.', metadata: { department: 'Operations', version: '1.4' } },
      { type: BusinessKnowledgeType.CONTRACT, title: 'Master Service Agreement Template', content: 'Enterprise SaaS agreement template.', metadata: { department: 'Legal', version: '3.0' } },
      { type: BusinessKnowledgeType.REPORT, title: 'Q4 2025 Sales Summary', content: 'Revenue up 18% YoY. Churn 2.1%.', metadata: { department: 'Finance', period: 'Q4-2025' } },
    ]
    for (const d of docs) {
      await prisma.businessKnowledge.create({
        data: {
          tenantId,
          ...d,
          embeddingContentHash: hash(`${d.title}\n${d.content}`),
        },
      })
    }
    console.log('  ✓ Business knowledge')
  } else {
    console.log('  ✓ Business knowledge (already present)')
  }

  const existingSalesEvents = await prisma.salesEvent.count({ where: { tenantId } })
  if (existingSalesEvents >= 200) {
    console.log('  ✓ Analytics events (already seeded)')
    return
  }

  const tenantContacts = await prisma.crmContact.findMany({ where: { tenantId }, take: 3 })
  const tenantCustomers = await prisma.customer.findMany({ where: { tenantId }, take: 3 })
  const tenantProducts = await prisma.product.findMany({ where: { tenantId }, take: 3 })
  const tenantSuppliers = await prisma.supplier.findMany({ where: { tenantId }, take: 3 })
  const channels = ['online', 'retail', 'wholesale', 'direct']
  const branches = ['HQ', 'North', 'South', 'West']

  for (let day = 0; day < 90; day++) {
    const ts = new Date()
    ts.setDate(ts.getDate() - day)
    ts.setHours(9 + (day % 10), day % 60, 0, 0)

    for (let i = 0; i < 3; i++) {
      const product = tenantProducts[i % tenantProducts.length]
      const contact = tenantContacts[i % tenantContacts.length]
      const customer = tenantCustomers[i % tenantCustomers.length]
      if (!product) continue

      const qty = 1 + (day + i) % 5
      const unitPrice = 500 + i * 300 + (day % 7) * 50
      const revenue = qty * unitPrice
      const cost = revenue * (0.55 + i * 0.05)

      await prisma.salesEvent.create({
        data: {
          tenantId,
          productId: product.id,
          customerId: contact?.id ?? customer?.id ?? null,
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

    if (day % 7 === 0 && tenantCustomers[0]) {
      await prisma.customerEvent.create({
        data: {
          tenantId,
          customerId: tenantCustomers[0].id,
          type: day % 14 === 0 ? 'CHURN' : 'PURCHASE',
          metadata: { source: 'seed', orderValue: 1200 + day * 10 },
          timestamp: ts,
        },
      })
    }

    if (day % 5 === 0 && tenantSuppliers[0]) {
      await prisma.supplierEvent.create({
        data: {
          tenantId,
          supplierId: tenantSuppliers[day % tenantSuppliers.length]!.id,
          type: day % 10 === 0 ? 'DELAY' : 'DELIVERY',
          metadata: { cost: 800 + day * 5, daysLate: day % 10 === 0 ? 3 : 0 },
          timestamp: ts,
        },
      })
    }
  }
  console.log('  ✓ Analytics events')
}

async function main() {
  const email = (process.argv[2] ?? DEFAULT_EMAIL).trim().toLowerCase()
  console.log(`🌱 Seeding demo data for ${email}…`)

  await ensureDatabaseReady()

  const user = await prisma.user.findFirst({
    where: { email, isActive: true },
    include: { tenant: true },
  })

  if (!user) {
    console.error(`❌ No active user found with email "${email}".`)
    console.error('   Register at /register first, then run this command again.')
    process.exit(1)
  }

  if (user.role !== 'OWNER' && user.role !== 'CEO') {
    console.warn(`⚠ User role is ${user.role} — seeding tenant "${user.tenant.slug}" anyway.`)
  }

  console.log(`  Tenant: ${user.tenant.name} (${user.tenant.slug})`)
  await seedDemoDataForTenant(user.tenantId, user.id, user.tenant.slug)
  console.log(`✅ Demo data seeded for ${email} → workspace "${user.tenant.slug}"`)
  console.log('   Restart dev if it was stopped, then hard-refresh the browser (Ctrl+Shift+R).')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

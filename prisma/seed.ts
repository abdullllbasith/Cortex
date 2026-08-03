import { TenantPlan, BusinessKnowledgeType } from '@prisma/client'
import { createHash } from 'crypto'
import prisma from '../src/lib/db/prismaClient'
import { seedPipelinesForTenant } from '../src/lib/crm/pipelineService'
import { seedAllWorkflowTemplatesForTenant } from '../src/lib/workflows/workflowTemplateSeed'
import { seedDefaultAccounts } from '../src/lib/finance/chartOfAccountsService'
import {
  seedCrmContactsForTenant,
  seedDashboardActivity,
  seedHrForTenant,
} from './seedHr'

const TENANTS = [
  { name: 'Acme Corporation', slug: 'acme-corp', plan: TenantPlan.ENTERPRISE },
  { name: 'Globex Industries', slug: 'globex', plan: TenantPlan.PROFESSIONAL },
  { name: 'Initech Solutions', slug: 'initech', plan: TenantPlan.STARTER },
] as const

function hash(content: string) {
  return createHash('sha256').update(content).digest('hex')
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function ensureDatabaseReady() {
  const maxAttempts = 5
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`
      return
    } catch (err) {
      if (attempt === maxAttempts) throw err
      const delayMs = attempt * 1500
      console.warn(
        `Database unreachable (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms…`,
      )
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

async function main() {
  console.log('🌱 Seeding Cortex Knowledge Engine…')
  await ensureDatabaseReady()

  for (const t of TENANTS) {
    const tenant = await prisma.tenant.upsert({
      where: { slug: t.slug },
      update: { name: t.name, plan: t.plan },
      create: { name: t.name, slug: t.slug, plan: t.plan },
    })

    console.log(`  ✓ Tenant: ${tenant.name}`)

    await seedPipelinesForTenant(tenant.id)
    await seedDefaultAccounts(tenant.id, { currency: 'USD' })

    // Owner user for dev auth (Module 08)
    const owner = await prisma.user.upsert({
      where: { supabaseId: `dev-owner-${tenant.slug}` },
      update: { fullName: `${tenant.name} Owner`, role: 'OWNER', isActive: true },
      create: {
        tenantId: tenant.id,
        supabaseId: `dev-owner-${tenant.slug}`,
        email: `owner@${tenant.slug}.test`,
        fullName: `${tenant.name} Owner`,
        role: 'OWNER',
      },
    })

    await seedCrmContactsForTenant(prisma, tenant.id, owner.id)
    await seedAllWorkflowTemplatesForTenant(tenant.id, owner.id)
    await seedHrForTenant(prisma, tenant.id, owner.id, tenant.slug)
    await seedDashboardActivity(prisma, tenant.id, owner.id)

    // Customers
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
      const content = JSON.stringify(c)
      await prisma.customer.create({
        data: {
          tenantId: tenant.id,
          ...c,
          embeddingContentHash: hash(content),
        },
      })
    }

    // Products
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
        where: { tenantId_sku: { tenantId: tenant.id, sku } },
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
          tenantId: tenant.id,
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

    // Suppliers
    const suppliers = [
      { name: 'TechParts Co', performanceScore: 92.5, deliveryHistory: [{ month: '2025-11', onTimeRate: 0.96 }], reliabilityMetrics: { defectRate: 0.02, avgLeadTimeDays: 5 }, costTrends: [{ quarter: 'Q4-2025', avgCostChange: -0.03 }] },
      { name: 'SensorWorks', performanceScore: 87.0, deliveryHistory: [{ month: '2025-11', onTimeRate: 0.89 }], reliabilityMetrics: { defectRate: 0.05, avgLeadTimeDays: 12 }, costTrends: [{ quarter: 'Q4-2025', avgCostChange: 0.07 }] },
      { name: 'CloudBase Inc', performanceScore: 98.2, deliveryHistory: [{ month: '2025-11', onTimeRate: 0.99 }], reliabilityMetrics: { defectRate: 0.001, avgLeadTimeDays: 1 }, costTrends: [{ quarter: 'Q4-2025', avgCostChange: -0.01 }] },
    ]

    for (const s of suppliers) {
      const content = `${s.name} score:${s.performanceScore}`
      const code = slugify(s.name).toUpperCase().replace(/-/g, '_') || 'SUPPLIER'
      await prisma.supplier.upsert({
        where: { tenantId_code: { tenantId: tenant.id, code } },
        update: {
          name: s.name,
          performanceScore: s.performanceScore,
          deliveryHistory: s.deliveryHistory,
          reliabilityMetrics: s.reliabilityMetrics,
          costTrends: s.costTrends,
          embeddingContentHash: hash(content),
        },
        create: {
          tenantId: tenant.id,
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

    // Business knowledge
    const docs = [
      { type: BusinessKnowledgeType.POLICY, title: 'Data Retention Policy', content: 'All customer data must be retained for 7 years per GDPR compliance. Automated deletion workflows apply after retention period.', metadata: { department: 'Legal', version: '2.1' } },
      { type: BusinessKnowledgeType.SOP, title: 'Order Fulfillment SOP', content: 'Step 1: Validate inventory. Step 2: Generate pick list. Step 3: Quality check. Step 4: Ship within 24 hours.', metadata: { department: 'Operations', version: '1.4' } },
      { type: BusinessKnowledgeType.CONTRACT, title: 'Master Service Agreement Template', content: 'This agreement governs the provision of enterprise SaaS services between Cortex and the client entity.', metadata: { department: 'Legal', version: '3.0' } },
      { type: BusinessKnowledgeType.REPORT, title: 'Q4 2025 Sales Summary', content: 'Total revenue increased 18% YoY. Top performing segment: Enterprise Analytics. Churn rate: 2.1%.', metadata: { department: 'Finance', period: 'Q4-2025' } },
    ]

    for (const d of docs) {
      const content = `${d.title}\n${d.content}`
      await prisma.businessKnowledge.create({
        data: {
          tenantId: tenant.id,
          ...d,
          embeddingContentHash: hash(content),
        },
      })
    }

    // Analytics events (Module 04) — link sales to CRM contacts when available
    const existingSalesEvents = await prisma.salesEvent.count({ where: { tenantId: tenant.id } })
    if (existingSalesEvents >= 200) {
      console.log(`  ✓ Analytics events (${tenant.slug}): already seeded`)
      continue
    }

    const tenantContacts = await prisma.crmContact.findMany({ where: { tenantId: tenant.id }, take: 3 })
    const tenantCustomers = await prisma.customer.findMany({ where: { tenantId: tenant.id }, take: 3 })
    const tenantProducts = await prisma.product.findMany({ where: { tenantId: tenant.id }, take: 3 })
    const tenantSuppliers = await prisma.supplier.findMany({ where: { tenantId: tenant.id }, take: 3 })

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
        const cost = revenue * (0.55 + (i * 0.05))

        await prisma.salesEvent.create({
          data: {
            tenantId: tenant.id,
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
            tenantId: tenant.id,
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
            tenantId: tenant.id,
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
            tenantId: tenant.id,
            supplierId: tenantSuppliers[day % tenantSuppliers.length]!.id,
            type: day % 10 === 0 ? 'DELAY' : 'DELIVERY',
            metadata: { cost: 800 + day * 5, daysLate: day % 10 === 0 ? 3 : 0 },
            timestamp: ts,
          },
        })
      }
    }
  }

  console.log('✅ Seed complete — tenants, CRM, HR, finance, dashboard activity, and analytics events.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

import { prisma } from '@/lib/db/prisma'

export function parsePeriod(period?: string): { start: Date; end: Date; label: string } {
  const now = new Date()
  const label = period ?? 'this month'

  const lastDays = label.match(/last\s+(\d+)\s+days/i)
  if (lastDays) {
    const days = parseInt(lastDays[1], 10)
    return { start: new Date(now.getTime() - days * 86400000), end: now, label }
  }

  if (/this month/i.test(label)) {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now, label }
  }

  if (/this quarter/i.test(label)) {
    const q = Math.floor(now.getMonth() / 3)
    return { start: new Date(now.getFullYear(), q * 3, 1), end: now, label }
  }

  if (/march/i.test(label)) {
    const year = now.getFullYear()
    return {
      start: new Date(year, 2, 1),
      end: new Date(year, 3, 0),
      label: `March ${year}`,
    }
  }

  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now, label }
}

export async function getTenantProductStats(tenantId: string) {
  const products = await prisma.product.findMany({
    where: { tenantId },
    select: { id: true, name: true, inventoryLevel: true, catalog: true, pricingHistory: true, updatedAt: true },
  })

  let revenue = 0
  let cogs = 0

  for (const p of products) {
    const catalog = p.catalog as Record<string, unknown>
    const price = Number(catalog.price ?? catalog.unitPrice ?? 100)
    const cost = Number(catalog.cost ?? price * 0.6)
    revenue += price * Math.max(p.inventoryLevel, 1) * 0.3
    cogs += cost * Math.max(p.inventoryLevel, 1) * 0.2
  }

  return { products, revenue, cogs, expenses: cogs * 1.15 }
}

export async function getTenantCustomerStats(tenantId: string) {
  const customers = await prisma.customer.findMany({
    where: { tenantId },
    select: { id: true, profile: true, purchaseHistory: true, loyaltyData: true, updatedAt: true },
  })
  return customers
}

import type { PrismaClient } from '@prisma/client'

/**
 * Demo sales were seeded with absolute timestamps. After a few weeks the
 * dashboard "last 14 days" / "today" windows show $0 even though data exists.
 * Shift event clocks so the newest event lands near "now".
 */
export async function refreshDemoSalesWindow(
  prisma: PrismaClient,
  tenantId: string,
  options?: { maxAgeDays?: number },
): Promise<{ refreshed: boolean; shiftedDays: number; salesEvents: number }> {
  const maxAgeDays = options?.maxAgeDays ?? 2

  const latest = await prisma.salesEvent.findFirst({
    where: { tenantId },
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true },
  })

  const count = await prisma.salesEvent.count({ where: { tenantId } })
  if (!latest || count === 0) {
    return { refreshed: false, shiftedDays: 0, salesEvents: 0 }
  }

  const ageMs = Date.now() - latest.timestamp.getTime()
  const ageDays = ageMs / (24 * 60 * 60 * 1000)
  if (ageDays <= maxAgeDays) {
    return { refreshed: false, shiftedDays: 0, salesEvents: count }
  }

  // Align newest event to ~now (minus a few minutes so "today" still includes it).
  const target = new Date()
  target.setMinutes(target.getMinutes() - 15)
  const deltaSeconds = Math.round((target.getTime() - latest.timestamp.getTime()) / 1000)

  await prisma.$executeRaw`
    UPDATE sales_events
    SET timestamp = timestamp + (${deltaSeconds} * interval '1 second')
    WHERE "tenantId" = ${tenantId}
  `
  await prisma.$executeRaw`
    UPDATE inventory_events
    SET timestamp = timestamp + (${deltaSeconds} * interval '1 second')
    WHERE "tenantId" = ${tenantId}
  `
  await prisma.$executeRaw`
    UPDATE customer_events
    SET timestamp = timestamp + (${deltaSeconds} * interval '1 second')
    WHERE "tenantId" = ${tenantId}
  `
  await prisma.$executeRaw`
    UPDATE supplier_events
    SET timestamp = timestamp + (${deltaSeconds} * interval '1 second')
    WHERE "tenantId" = ${tenantId}
  `
  await prisma.analyticsSnapshot.deleteMany({ where: { tenantId } })

  return {
    refreshed: true,
    shiftedDays: Math.round(ageDays),
    salesEvents: count,
  }
}

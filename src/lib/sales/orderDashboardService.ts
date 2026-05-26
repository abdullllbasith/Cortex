import { SalesOrderStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

function monthStart() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function getOrderDashboard(tenantId: string) {
  const start = monthStart()
  const [newOrders, processing, readyToShip, deliveredThisMonth, cancelled] = await Promise.all([
    prisma.salesOrder.count({
      where: { tenantId, status: { in: [SalesOrderStatus.DRAFT, SalesOrderStatus.CONFIRMED] } },
    }),
    prisma.salesOrder.count({
      where: { tenantId, status: { in: [SalesOrderStatus.PROCESSING, SalesOrderStatus.PICKING] } },
    }),
    prisma.salesOrder.count({
      where: { tenantId, status: SalesOrderStatus.PACKED },
    }),
    prisma.salesOrder.count({
      where: { tenantId, deliveredAt: { gte: start } },
    }),
    prisma.salesOrder.count({
      where: { tenantId, status: SalesOrderStatus.CANCELLED },
    }),
  ])

  return { newOrders, processing, readyToShip, deliveredThisMonth, cancelled }
}

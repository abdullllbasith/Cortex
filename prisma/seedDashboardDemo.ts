import { DealStatus, InvoiceStatus, SalesOrderStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import type { PrismaClient } from '@prisma/client'
import { getDefaultPipeline } from '../src/lib/crm/pipelineService'
import { backfillSalesEventContacts } from './seedHr'

const d = (n: number) => new Decimal(n)

/** CRM deals, orders, invoices, and fresh sales activity for the master dashboard. */
export async function seedDashboardDemoData(
  prisma: PrismaClient,
  tenantId: string,
  ownerUserId: string,
) {
  const pipeline = await getDefaultPipeline(tenantId)
  const contacts = await prisma.crmContact.findMany({
    where: { tenantId },
    take: 3,
    orderBy: { createdAt: 'asc' },
  })

  const dealCount = await prisma.crmDeal.count({ where: { tenantId } })
  if (dealCount === 0 && pipeline && contacts.length > 0) {
    const deals = [
      { title: 'Northwind — Analytics rollout', stageId: 'demo', value: 42000, contact: contacts[0] },
      { title: 'Contoso — Sensor pilot', stageId: 'proposal', value: 18500, contact: contacts[1] ?? contacts[0] },
      { title: 'Fabrikam — Enterprise renewal', stageId: 'negotiation', value: 96000, contact: contacts[2] ?? contacts[0] },
    ]
    for (const deal of deals) {
      if (!deal.contact) continue
      await prisma.crmDeal.create({
        data: {
          tenantId,
          title: deal.title,
          contactId: deal.contact.id,
          ownerId: ownerUserId,
          pipelineId: pipeline.id,
          stageId: deal.stageId,
          value: d(deal.value),
          probability: deal.stageId === 'negotiation' ? 80 : deal.stageId === 'proposal' ? 60 : 40,
          expectedCloseDate: new Date(Date.now() + 21 * 86400000),
          status: DealStatus.OPEN,
        },
      })
    }
    console.log('  ✓ CRM deals')
  }

  const orderCount = await prisma.salesOrder.count({ where: { tenantId } })
  if (orderCount === 0 && contacts.length > 0) {
    const orders = [
      { orderNumber: 'SO-1001', status: SalesOrderStatus.PROCESSING, total: 12400, contact: contacts[0] },
      { orderNumber: 'SO-1002', status: SalesOrderStatus.CONFIRMED, total: 8900, contact: contacts[1] ?? contacts[0] },
      { orderNumber: 'SO-1003', status: SalesOrderStatus.PICKING, total: 15600, contact: contacts[2] ?? contacts[0] },
    ]
    for (const order of orders) {
      if (!order.contact) continue
      await prisma.salesOrder.create({
        data: {
          tenantId,
          orderNumber: order.orderNumber,
          contactId: order.contact.id,
          ownerId: ownerUserId,
          status: order.status,
          subtotal: d(order.total),
          total: d(order.total),
          items: [{ sku: 'EAS-001', name: 'Enterprise Analytics Suite', qty: 1, price: order.total }],
        },
      })
    }
    console.log('  ✓ Sales orders')
  }

  const invoiceCount = await prisma.invoice.count({ where: { tenantId } })
  if (invoiceCount === 0 && contacts.length > 0) {
    const overdueDue = new Date()
    overdueDue.setDate(overdueDue.getDate() - 10)
    const issueDate = new Date(overdueDue)
    issueDate.setDate(issueDate.getDate() - 30)

    await prisma.invoice.create({
      data: {
        tenantId,
        invoiceNumber: 'INV-1001',
        contactId: contacts[0]!.id,
        status: InvoiceStatus.OVERDUE,
        issueDate,
        dueDate: overdueDue,
        subtotal: d(8500),
        total: d(8500),
        amountDue: d(8500),
        items: [{ description: 'Analytics Suite — annual license', qty: 1, price: 8500 }],
        createdBy: ownerUserId,
      },
    })

    await prisma.invoice.create({
      data: {
        tenantId,
        invoiceNumber: 'INV-1002',
        contactId: (contacts[1] ?? contacts[0])!.id,
        status: InvoiceStatus.SENT,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 86400000),
        subtotal: d(4200),
        total: d(4200),
        amountDue: d(4200),
        items: [{ description: 'Sensor kit bundle', qty: 1, price: 4200 }],
        createdBy: ownerUserId,
      },
    })
    console.log('  ✓ Invoices')
  }

  if (contacts.length > 0) {
    const followUpDue = new Date()
    followUpDue.setDate(followUpDue.getDate() - 3)
    await prisma.crmContact.update({
      where: { id: contacts[0]!.id },
      data: { nextFollowUpAt: followUpDue },
    })
  }

  await refreshTodaySalesEvents(prisma, tenantId)
  await backfillSalesEventContacts(prisma, tenantId)
}

async function refreshTodaySalesEvents(prisma: PrismaClient, tenantId: string) {
  const latest = await prisma.salesEvent.findMany({
    where: { tenantId },
    orderBy: { timestamp: 'desc' },
    take: 3,
  })
  if (latest.length === 0) return

  const now = new Date()
  for (let i = 0; i < latest.length; i++) {
    const ts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9 + i, 15, 0, 0)
    await prisma.salesEvent.update({
      where: { id: latest[i]!.id },
      data: { timestamp: ts },
    })
  }
  console.log('  ✓ Today sales activity refreshed')
}

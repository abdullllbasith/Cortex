import { SalesOrderStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  querySalesMetrics,
  queryTodaySales,
  queryTopCustomers,
  resolveAnalyticsPeriod,
} from '@/lib/analytics/salesDataService'
import type { ActionTaken, IntentClassification } from '../types'
import { completedAction, confirmationAction, failedAction } from './actionUtils'

function mapPeriod(period: string): string {
  if (/today/i.test(period)) return 'today'
  if (/week|7\s*days/i.test(period)) return 'week'
  if (/quarter/i.test(period)) return 'quarter'
  return 'month'
}

async function findContactByName(tenantId: string, name: string) {
  if (!name) return null
  const parts = name.trim().split(/\s+/)
  return prisma.crmContact.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { email: { contains: name, mode: 'insensitive' } },
        {
          AND: [
            { firstName: { contains: parts[0], mode: 'insensitive' } },
            parts[1]
              ? { lastName: { contains: parts[1], mode: 'insensitive' } }
              : {},
          ],
        },
        { company: { contains: name, mode: 'insensitive' } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true },
  })
}

export async function handleSalesAction(
  tenantId: string,
  userId: string,
  message: string,
  classification: IntentClassification,
): Promise<ActionTaken[]> {
  const period = String(classification.entities.period ?? 'this month')
  const lower = message.toLowerCase()
  const contactName = String(classification.entities.contactName ?? '').trim()

  if (/\b(top\s+customers?|best\s+customers?|who\s+are\s+my\s+(top|best)\s+customers?)\b/i.test(message)) {
    const range = resolveAnalyticsPeriod(
      /this\s+month|month/i.test(message) ? 'month' : mapPeriod(period),
    )
    const top = await queryTopCustomers(tenantId, range, 5)
    const lines = top
      .map((c, i) => `${i + 1}. ${c.name}: $${Math.round(c.revenue).toLocaleString()}`)
      .join('\n')

    return [
      completedAction({
        type: 'sales.top_customers',
        description:
          top.length > 0
            ? `Top customers (${range.label}):\n${lines}`
            : 'No customer revenue recorded for this period',
        undoPayload: { customers: top },
      }),
    ]
  }

  const isTodaySales =
    /\btoday('s)?\s+sales\b/i.test(message) ||
    (/\bsales\b/i.test(lower) && /\btoday\b/i.test(lower))

  if (isTodaySales) {
    const metrics = await queryTodaySales(tenantId)
    return [
      completedAction({
        type: 'sales.report',
        description: `Today's sales: $${Math.round(metrics.totalRevenue).toLocaleString()} revenue across ${metrics.totalOrders} order(s)`,
        undoPayload: { ...metrics },
      }),
    ]
  }

  if (/\bopen\s+orders?\b/i.test(lower) || /\borders?\s+not\s+delivered\b/i.test(lower)) {
    const orders = await prisma.salesOrder.findMany({
      where: {
        tenantId,
        status: { notIn: [SalesOrderStatus.DELIVERED, SalesOrderStatus.CANCELLED] },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        contact: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    })

    const lines = orders
      .map(
        (o) =>
          `• ${o.orderNumber} (${o.status}): $${Number(o.total).toLocaleString()} — ${o.contact ? `${o.contact.firstName} ${o.contact.lastName}`.trim() : 'No contact'}`,
      )
      .join('\n')

    return [
      completedAction({
        type: 'sales.open_orders',
        description:
          orders.length > 0
            ? `${orders.length} open order(s):\n${lines}`
            : 'No open orders — all caught up',
        undoPayload: { orders },
      }),
    ]
  }

  if (/\b(create|new|draft)\b.*\bquote\b/i.test(lower) && contactName) {
    const contact = await findContactByName(tenantId, contactName)
    if (!contact) {
      return [failedAction(`Contact "${contactName}" not found`, 'sales.create_quote')]
    }

    return [
      confirmationAction({
        type: 'sales.create_quote',
        description: `Start quote for ${contact.firstName} ${contact.lastName}`.trim(),
        displayTitle: 'Create sales quote',
        parameters: [
          { label: 'Contact', value: `${contact.firstName} ${contact.lastName}`.trim() },
          { label: 'Email', value: contact.email ?? '—' },
        ],
        executePayload: {
          contactId: contact.id,
          lineItems: [],
        },
        entityType: 'contact',
        entityId: contact.id,
      }),
    ]
  }

  if (classification.intent === 'REPORT' || /\bsales\b/i.test(message)) {
    const metrics = await querySalesMetrics(
      tenantId,
      resolveAnalyticsPeriod(mapPeriod(period)),
    )
    return [
      completedAction({
        type: 'sales.report',
        description: `Sales (${period}): $${Math.round(metrics.totalRevenue).toLocaleString()} revenue, ${metrics.totalOrders} orders, $${Math.round(metrics.avgOrderValue).toLocaleString()} avg`,
        undoPayload: { ...metrics },
      }),
    ]
  }

  return []
}

export async function undoSalesAction(_tenantId: string, _action: ActionTaken): Promise<boolean> {
  return false
}

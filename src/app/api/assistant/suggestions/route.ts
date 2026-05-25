import { NextResponse } from 'next/server'
import { InvoiceStatus } from '@prisma/client'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { prisma } from '@/lib/db/prisma'
import { InventoryAgent } from '@/lib/agents/InventoryAgent'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const tenantId = auth.tenantId
    const now = new Date()

    const [overdueInvoices, lowStock, overdueContacts] = await Promise.all([
      prisma.invoice.count({
        where: {
          tenantId,
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] },
          dueDate: { lt: now },
          amountDue: { gt: 0 },
        },
      }),
      new InventoryAgent(tenantId).getLowStockItems(),
      prisma.crmContact.count({
        where: { tenantId, isActive: true, nextFollowUpAt: { lt: now } },
      }),
    ])

    const suggestions: Array<{ id: string; text: string; category: string }> = []

    if (overdueInvoices > 0) {
      suggestions.push({
        id: 'overdue-invoices',
        text: 'Show me overdue invoices',
        category: 'Finance',
      })
    }
    if (lowStock.count > 0) {
      suggestions.push({
        id: 'low-stock',
        text: "What's low on stock?",
        category: 'Inventory',
      })
    }
    if (overdueContacts > 0) {
      suggestions.push({
        id: 'overdue-followups',
        text: 'Who needs a follow-up today?',
        category: 'CRM',
      })
    }

    suggestions.push(
      { id: 'daily-briefing', text: 'Give me my daily executive briefing', category: 'Analytics' },
      { id: 'pipeline', text: 'Summarize the sales pipeline', category: 'Sales' },
      { id: 'ar-ap', text: 'What is our AR and AP position?', category: 'Finance' },
    )

    return NextResponse.json(apiSuccess({ suggestions: suggestions.slice(0, 8) }))
  } catch (err) {
    return handleRouteError(err)
  }
})

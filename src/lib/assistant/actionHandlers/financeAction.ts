import { FinancePaymentType, InvoiceStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { FinanceAgent } from '@/lib/agents/FinanceAgent'
import { fetchMonthlyProfit } from './actionExecutor'
import type { ActionTaken, IntentClassification } from '../types'
import { completedAction, confirmationAction, failedAction } from './actionUtils'

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

export async function handleFinanceAction(
  tenantId: string,
  userId: string,
  message: string,
  classification: IntentClassification,
): Promise<ActionTaken[]> {
  void userId
  const lower = message.toLowerCase()
  const amount = Number(classification.entities.amount ?? 0)
  const invoiceRef = String(classification.entities.invoiceNumber ?? classification.entities.invoiceId ?? '').trim()

  if (
    /\b(revenue|collected)\b/i.test(message) &&
    /\b(month|monthly|mtd|this\s+month'?s?)\b/i.test(message)
  ) {
    const agent = new FinanceAgent(tenantId)
    const revenue = await agent.getRevenue('month')
    return [
      completedAction({
        type: 'finance.revenue',
        description: `Revenue this month: $${revenue.totalRevenue.toLocaleString()} collected (${revenue.paymentCount} payment(s))`,
        undoPayload: revenue,
      }),
    ]
  }

  if (/\bprofit\b.*\b(month|this month)\b/i.test(lower) || /\bp\s*&\s*l\b/i.test(lower)) {
    const pnl = await fetchMonthlyProfit(tenantId)
    return [
      completedAction({
        type: 'finance.profit_and_loss',
        description: `MTD P&L: revenue $${pnl.revenueTotal?.toLocaleString() ?? 0}, expenses $${pnl.expenseTotal?.toLocaleString() ?? 0}, net $${pnl.netIncome?.toLocaleString() ?? 0} (${pnl.changePercent ?? 0}% vs prior)`,
        undoPayload: pnl,
      }),
    ]
  }

  if (/\boverdue\s+invoices?\b/i.test(lower)) {
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        status: InvoiceStatus.OVERDUE,
        amountDue: { gt: 0 },
      },
      select: {
        id: true,
        invoiceNumber: true,
        amountDue: true,
        dueDate: true,
        contact: { select: { firstName: true, lastName: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    })

    const total = invoices.reduce((s, i) => s + toNumber(i.amountDue), 0)
    const lines = invoices
      .slice(0, 8)
      .map(
        (i) =>
          `• ${i.invoiceNumber}: $${toNumber(i.amountDue).toLocaleString()} due ${i.dueDate.toISOString().slice(0, 10)}`,
      )
      .join('\n')

    return [
      completedAction({
        type: 'finance.overdue_invoices',
        description:
          invoices.length > 0
            ? `${invoices.length} overdue invoice(s) totaling $${total.toLocaleString()}:\n${lines}`
            : 'No overdue invoices',
        undoPayload: { invoices },
      }),
    ]
  }

  if (
    /\brecord\b.*\bpayment\b/i.test(lower) ||
    (/\bpayment\b/i.test(lower) && invoiceRef)
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        tenantId,
        OR: [
          { invoiceNumber: { equals: invoiceRef, mode: 'insensitive' } },
          { id: invoiceRef },
        ],
      },
      select: { id: true, invoiceNumber: true, amountDue: true, status: true },
    })

    if (!invoice) {
      return [
        failedAction(
          invoiceRef ? `Invoice "${invoiceRef}" not found` : 'Specify an invoice number to record payment',
          'finance.record_payment',
        ),
      ]
    }

    const payAmount = amount > 0 ? amount : toNumber(invoice.amountDue)
    if (payAmount <= 0) {
      return [failedAction('Payment amount must be greater than zero', 'finance.record_payment')]
    }

    return [
      confirmationAction({
        type: 'finance.record_payment',
        description: `Record $${payAmount.toLocaleString()} payment on ${invoice.invoiceNumber}`,
        displayTitle: 'Record invoice payment',
        parameters: [
          { label: 'Invoice', value: invoice.invoiceNumber },
          { label: 'Amount', value: `$${payAmount.toLocaleString()}` },
          { label: 'Balance due', value: `$${toNumber(invoice.amountDue).toLocaleString()}` },
        ],
        executePayload: {
          invoiceId: invoice.id,
          amount: payAmount,
          paymentMethod: 'BANK_TRANSFER',
        },
        entityType: 'invoice',
        entityId: invoice.id,
      }),
    ]
  }

  if (/\b(outstanding\s+ar|receivable)\b/i.test(lower)) {
    const agent = new FinanceAgent(tenantId)
    const ar = await agent.getOutstandingAR()
    return [
      completedAction({
        type: 'finance.ar_summary',
        description: `Outstanding AR: $${ar.totalOutstanding.toLocaleString()} across ${ar.openInvoiceCount} open invoice(s)`,
        undoPayload: ar,
      }),
    ]
  }

  if (/\b(revenue|profit|margin|cash|financial)\b/i.test(message)) {
    const agent = new FinanceAgent(tenantId)
    const [revenue, ar] = await Promise.all([
      agent.getRevenue('month'),
      agent.getOutstandingAR(),
    ])
    return [
      completedAction({
        type: 'finance.summary',
        description: `Finance snapshot: $${revenue.totalRevenue.toLocaleString()} collected MTD; AR outstanding $${ar.totalOutstanding.toLocaleString()}`,
        undoPayload: { revenue, ar },
      }),
    ]
  }

  return []
}

export async function undoFinanceAction(_tenantId: string, _action: ActionTaken): Promise<boolean> {
  return false
}

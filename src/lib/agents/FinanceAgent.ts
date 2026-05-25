import { FinancePaymentMethod, FinancePaymentType, InvoiceStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { getApAgingReport } from '@/lib/finance/billService'
import {
  createInvoice as createInvoiceRecord,
  getArAgingReport,
  recordPayment as recordInvoicePayment,
} from '@/lib/finance/invoiceService'
import { getProfitAndLoss } from '@/lib/finance/reportingService'
import { BaseAgent } from './core/BaseAgent'
import type { AgentTaskInput, AgentToolDefinition } from './core/types'

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

type FinancePeriod = 'today' | 'week' | 'month' | 'quarter'

function resolveFinancePeriod(period: string): { start: Date; end: Date; label: string } {
  const normalized = period.toLowerCase().replace(/\s+/g, '')
  const now = new Date()
  const end = new Date(now)
  let start: Date

  if (normalized === 'today' || normalized === 'thisday') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { start, end, label: 'Today' }
  }
  if (normalized === 'week' || normalized === 'thisweek' || normalized === 'last7days') {
    start = new Date(now.getTime() - 7 * 86400000)
    return { start, end, label: 'Last 7 days' }
  }
  if (normalized === 'quarter' || normalized === 'thisquarter') {
    const q = Math.floor(now.getMonth() / 3)
    start = new Date(now.getFullYear(), q * 3, 1)
    return { start, end, label: 'This quarter' }
  }
  start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { start, end, label: 'This month' }
}

function periodToReportDates(period: string) {
  const { start, end, label } = resolveFinancePeriod(period)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    label,
  }
}

const OPEN_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIAL,
  InvoiceStatus.VIEWED,
  InvoiceStatus.OVERDUE,
]

export class FinanceAgent extends BaseAgent<AgentTaskInput, Record<string, unknown>> {
  private readonly actorId?: string

  readonly systemPrompt = `You are an expert CFO AI agent with full AR/AP, invoicing, and reporting access.
Revenue is recognized from invoice payments in the ledger. All figures come from live finance tables — never estimate balances.`

  readonly tools: AgentToolDefinition[] = [
    { name: 'getRevenue', description: 'Sum invoice payments in period', parameters: { period: 'string' } },
    { name: 'getOutstandingAR', description: 'Unpaid invoices by aging bucket' },
    { name: 'getOutstandingAP', description: 'Unpaid bills by aging bucket' },
    { name: 'getProfitAndLoss', description: 'P&L for period', parameters: { period: 'string' } },
    { name: 'createInvoice', description: 'Create draft invoice', parameters: { contactId: 'string', items: 'array' } },
    { name: 'recordPayment', description: 'Record payment against invoice', parameters: { invoiceId: 'string', amount: 'number', paymentMethod: 'string' } },
    { name: 'queryKnowledgeBase', description: 'Search financial knowledge' },
  ]

  constructor(tenantId: string, userId?: string, taskId?: string) {
    super(tenantId, 'finance', undefined, userId, taskId)
    this.actorId = userId
  }

  protected async executeTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'getRevenue':
        return this.getRevenue(String(input.period ?? 'month'))
      case 'getOutstandingAR':
        return this.getOutstandingAR()
      case 'getOutstandingAP':
        return this.getOutstandingAP()
      case 'getProfitAndLoss':
        return this.getProfitAndLoss(String(input.period ?? 'month'))
      case 'createInvoice':
        return this.createInvoice(
          String(input.contactId ?? ''),
          (input.items as Array<Record<string, unknown>>) ?? [],
        )
      case 'recordPayment':
        return this.recordPayment(
          String(input.invoiceId ?? ''),
          Number(input.amount ?? 0),
          String(input.paymentMethod ?? input.method ?? 'BANK_TRANSFER'),
        )
      case 'queryKnowledgeBase':
        return this.toolkit.queryKnowledgeBase(String(input.query ?? 'financial policy'), 'knowledge')
      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }

  protected heuristicThink(input: AgentTaskInput, iteration: number) {
    const lower = input.task.toLowerCase()
    if (/\bar\b|receivable/i.test(lower)) {
      return { reasoning: 'AR aging', plannedTool: 'getOutstandingAR', plannedInput: {}, iteration }
    }
    if (/\bap\b|payable/i.test(lower)) {
      return { reasoning: 'AP aging', plannedTool: 'getOutstandingAP', plannedInput: {}, iteration }
    }
    if (/p\s*&\s*l|profit|loss/i.test(lower)) {
      return { reasoning: 'P&L', plannedTool: 'getProfitAndLoss', plannedInput: { period: 'month' }, iteration }
    }
    if (/\brevenue|collected|cash in/i.test(lower)) {
      return { reasoning: 'Collected revenue', plannedTool: 'getRevenue', plannedInput: { period: 'month' }, iteration }
    }
    return { reasoning: 'Finance overview', plannedTool: 'getProfitAndLoss', plannedInput: { period: 'month' }, iteration }
  }

  /** Sum Payment.amount (INVOICE_PAYMENT) where paymentDate falls in period. */
  async getRevenue(period: string) {
    const range = resolveFinancePeriod(period)
    const agg = await prisma.payment.aggregate({
      where: {
        tenantId: this.tenantId,
        type: FinancePaymentType.INVOICE_PAYMENT,
        paymentDate: { gte: range.start, lte: range.end },
      },
      _sum: { amount: true },
      _count: true,
    })

    return {
      period: range.label as FinancePeriod | string,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      totalRevenue: Math.round(toNumber(agg._sum.amount) * 100) / 100,
      paymentCount: agg._count,
      currency: 'USD',
      source: 'finance_payments',
    }
  }

  async getOutstandingAR() {
    const [report, invoiceSum] = await Promise.all([
      getArAgingReport(this.tenantId),
      prisma.invoice.aggregate({
        where: {
          tenantId: this.tenantId,
          status: { in: OPEN_INVOICE_STATUSES },
        },
        _sum: { amountDue: true },
        _count: true,
      }),
    ])

    return {
      totalOutstanding: Math.round(toNumber(invoiceSum._sum.amountDue) * 100) / 100,
      openInvoiceCount: invoiceSum._count,
      buckets: report.buckets,
      currency: 'USD',
    }
  }

  async getOutstandingAP() {
    const report = await getApAgingReport(this.tenantId)
    return {
      totalOutstanding: report.totalOutstanding,
      buckets: report.buckets,
      currency: 'USD',
    }
  }

  async getProfitAndLoss(period: string) {
    const { startDate, endDate, label } = periodToReportDates(period)
    const report = await getProfitAndLoss(this.tenantId, startDate, endDate)
    return { ...report, periodLabel: label }
  }

  async createInvoice(contactId: string, items: Array<Record<string, unknown>>) {
    if (!contactId || !items.length) throw new Error('contactId and items are required')

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    const invoice = await createInvoiceRecord(
      this.tenantId,
      {
        contactId,
        dueDate: dueDate.toISOString(),
        issueDate: new Date().toISOString(),
        items: items.map((i) => ({
          description: String(i.description ?? i.name ?? 'Line item'),
          quantity: Number(i.quantity ?? 1),
          unitPrice: Number(i.unitPrice ?? i.price ?? 0),
          discount: Number(i.discount ?? 0),
          taxRate: Number(i.taxRate ?? 0),
          productId: i.productId ? String(i.productId) : null,
        })),
      },
      this.actorId,
    )

    return {
      id: invoice?.id,
      invoiceNumber: invoice?.invoiceNumber,
      status: invoice?.status,
      total: invoice?.total,
      amountDue: invoice?.amountDue,
      dueDate: invoice?.dueDate,
    }
  }

  async recordPayment(invoiceId: string, amount: number, paymentMethod: string) {
    if (!invoiceId || amount <= 0) throw new Error('invoiceId and positive amount are required')

    const normalized = paymentMethod.toUpperCase().replace(/\s+/g, '_')
    const method =
      normalized === 'CHECK' || normalized === 'CHEQUE'
        ? FinancePaymentMethod.CHEQUE
        : normalized === 'CREDIT' || normalized === 'CARD'
          ? FinancePaymentMethod.CREDIT
          : (FinancePaymentMethod[normalized as keyof typeof FinancePaymentMethod] ??
            FinancePaymentMethod.BANK_TRANSFER)

    const invoice = await recordInvoicePayment(
      invoiceId,
      this.tenantId,
      {
        amount,
        paymentMethod: method,
        paymentDate: new Date().toISOString(),
      },
      this.actorId,
    )

    return {
      invoiceId,
      invoiceNumber: invoice?.invoiceNumber,
      status: invoice?.status,
      amountPaid: invoice?.amountPaid,
      amountDue: invoice?.amountDue,
      paymentRecorded: amount,
    }
  }
}

import { prisma } from '@/lib/db/prisma'
import { getApAgingReport } from '@/lib/finance/billService'
import { getArAgingReport } from '@/lib/finance/invoiceService'
import { getProfitAndLoss } from '@/lib/finance/reportingService'
import { getAccountBalance } from '@/lib/finance/journalEngine'
import { GL_ACCOUNTS, resolveAccount } from '@/lib/finance/accountResolver'
import type { DateRange } from './periodUtils'

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

export interface FinanceAnalyticsResult {
  period: string
  profitAndLoss: {
    revenueTotal: number
    expenseTotal: number
    netIncome: number
    changePercent: number
  }
  accountsReceivable: {
    totalOutstanding: number
    buckets: Array<{ label: string; count: number; total: number }>
  }
  accountsPayable: {
    totalOutstanding: number
    buckets: Array<{ label: string; count: number; total: number }>
  }
  cashPosition: number
  collectedThisPeriod: number
  invoicedThisPeriod: number
}

export async function computeFinanceAnalytics(
  tenantId: string,
  range: DateRange,
): Promise<FinanceAnalyticsResult> {
  const startDate = range.start.toISOString().slice(0, 10)
  const endDate = range.end.toISOString().slice(0, 10)

  const [pnl, ar, ap, payments, invoices] = await Promise.all([
    getProfitAndLoss(tenantId, startDate, endDate),
    getArAgingReport(tenantId),
    getApAgingReport(tenantId),
    prisma.payment.aggregate({
      where: {
        tenantId,
        paymentDate: { gte: range.start, lte: range.end },
      },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        tenantId,
        issueDate: { gte: range.start, lte: range.end },
        status: { notIn: ['VOID', 'CANCELLED'] },
      },
      _sum: { total: true },
    }),
  ])

  let cashPosition = 0
  try {
    const cashAccount = await resolveAccount(tenantId, GL_ACCOUNTS.BANK.subtype, [...GL_ACCOUNTS.BANK.codes])
    cashPosition = await getAccountBalance(cashAccount.id, tenantId, range.end)
  } catch {
    cashPosition = 0
  }

  return {
    period: range.label,
    profitAndLoss: {
      revenueTotal: pnl.revenueTotal,
      expenseTotal: pnl.expenseTotal,
      netIncome: pnl.netIncome,
      changePercent: pnl.changePercent,
    },
    accountsReceivable: {
      totalOutstanding: ar.totalOutstanding,
      buckets: ar.buckets,
    },
    accountsPayable: {
      totalOutstanding: ap.totalOutstanding,
      buckets: ap.buckets,
    },
    cashPosition: Math.round(cashPosition * 100) / 100,
    collectedThisPeriod: Math.round(toNumber(payments._sum.amount) * 100) / 100,
    invoicedThisPeriod: Math.round(toNumber(invoices._sum.total) * 100) / 100,
  }
}

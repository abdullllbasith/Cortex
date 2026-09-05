import type { AccountType } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { getApAgingReport, getUpcomingBills } from './billService'
import { signedBalance, toNumber } from './financeTypes'
import { GL_ACCOUNTS, resolveAccount } from './accountResolver'
import { getAccountBalance } from './journalEngine'
import { getArAgingReport } from './invoiceService'

export interface ReportPeriod {
  startDate: Date
  endDate: Date
}

function parsePeriod(startDate?: string, endDate?: string): ReportPeriod {
  const end = endDate ? new Date(endDate) : new Date()
  end.setHours(23, 59, 59, 999)
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getFullYear(), end.getMonth(), 1)
  start.setHours(0, 0, 0, 0)
  return { startDate: start, endDate: end }
}

/** One accounts fetch + one grouped journal aggregate (no per-account N+1). */
async function aggregateAccountsByType(
  tenantId: string,
  types: AccountType[],
  startDate: Date,
  endDate: Date,
) {
  const accounts = await prisma.account.findMany({
    where: { tenantId, type: { in: types }, isActive: true },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, type: true },
  })

  if (accounts.length === 0) {
    return { rows: [] as Array<{ accountId: string; code: string; name: string; type: AccountType; amount: number }>, total: 0 }
  }

  const accountIds = accounts.map((a) => a.id)
  const sums = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      accountId: { in: accountIds },
      journalEntry: {
        tenantId,
        status: 'POSTED',
        date: { gte: startDate, lte: endDate },
      },
    },
    _sum: { debit: true, credit: true },
  })

  const byId = new Map(sums.map((s) => [s.accountId, s]))
  const rows: Array<{ accountId: string; code: string; name: string; type: AccountType; amount: number }> = []
  let total = 0

  for (const account of accounts) {
    const agg = byId.get(account.id)
    if (!agg) continue
    const debit = toNumber(agg._sum.debit)
    const credit = toNumber(agg._sum.credit)
    if (debit === 0 && credit === 0) continue

    const amount = Math.abs(signedBalance(account.type, debit, credit))
    total += amount
    rows.push({
      accountId: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      amount: Math.round(amount * 100) / 100,
    })
  }

  return { rows, total: Math.round(total * 100) / 100 }
}

async function aggregateAccountBalancesAsOf(tenantId: string, asOfDate: Date, types: AccountType[]) {
  const accounts = await prisma.account.findMany({
    where: { tenantId, type: { in: types }, isActive: true },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, type: true },
  })

  if (accounts.length === 0) {
    return { rows: [] as Array<{ accountId: string; code: string; name: string; type: AccountType; balance: number }>, total: 0 }
  }

  const accountIds = accounts.map((a) => a.id)
  const sums = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      accountId: { in: accountIds },
      journalEntry: {
        tenantId,
        status: 'POSTED',
        date: { lte: asOfDate },
      },
    },
    _sum: { debit: true, credit: true },
  })

  const byId = new Map(sums.map((s) => [s.accountId, s]))
  const rows: Array<{ accountId: string; code: string; name: string; type: AccountType; balance: number }> = []
  let total = 0

  for (const account of accounts) {
    const agg = byId.get(account.id)
    const debit = toNumber(agg?._sum.debit)
    const credit = toNumber(agg?._sum.credit)
    const balance = signedBalance(account.type, debit, credit)
    if (Math.abs(balance) < 0.005) continue
    total += balance
    rows.push({
      accountId: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      balance: Math.round(balance * 100) / 100,
    })
  }

  return { rows, total: Math.round(total * 100) / 100 }
}

export async function getProfitAndLoss(
  tenantId: string,
  startDate?: string,
  endDate?: string,
) {
  const period = parsePeriod(startDate, endDate)
  const prevEnd = new Date(period.startDate.getTime() - 1)
  prevEnd.setHours(23, 59, 59, 999)
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1)
  prevStart.setHours(0, 0, 0, 0)

  const [revenue, expenses, prevRevenue, prevExpenses] = await Promise.all([
    aggregateAccountsByType(tenantId, ['REVENUE'], period.startDate, period.endDate),
    aggregateAccountsByType(tenantId, ['EXPENSE'], period.startDate, period.endDate),
    aggregateAccountsByType(tenantId, ['REVENUE'], prevStart, prevEnd),
    aggregateAccountsByType(tenantId, ['EXPENSE'], prevStart, prevEnd),
  ])

  const grossProfit = revenue.total - expenses.rows
    .filter((r) => r.name.toLowerCase().includes('cogs') || r.code.startsWith('51'))
    .reduce((s, r) => s + r.amount, 0)
  const netIncome = revenue.total - expenses.total

  const prevNet = prevRevenue.total - prevExpenses.total
  const changePercent = prevNet !== 0
    ? Math.round(((netIncome - prevNet) / Math.abs(prevNet)) * 1000) / 10
    : 0

  return {
    period: {
      start: period.startDate.toISOString(),
      end: period.endDate.toISOString(),
    },
    revenue: revenue.rows,
    revenueTotal: revenue.total,
    expenses: expenses.rows,
    expenseTotal: expenses.total,
    grossProfit: Math.round(grossProfit * 100) / 100,
    netIncome: Math.round(netIncome * 100) / 100,
    previousPeriod: {
      revenueTotal: prevRevenue.total,
      expenseTotal: prevExpenses.total,
      netIncome: Math.round(prevNet * 100) / 100,
    },
    changePercent,
  }
}

export async function getBalanceSheet(tenantId: string, asOfDate?: string) {
  const asOf = asOfDate ? new Date(asOfDate) : new Date()
  asOf.setHours(23, 59, 59, 999)

  const [assets, liabilities, equity] = await Promise.all([
    aggregateAccountBalancesAsOf(tenantId, asOf, ['ASSET']),
    aggregateAccountBalancesAsOf(tenantId, asOf, ['LIABILITY']),
    aggregateAccountBalancesAsOf(tenantId, asOf, ['EQUITY']),
  ])

  const assetsTotal = assets.total
  const liabilitiesTotal = liabilities.total
  const equityTotal = equity.total
  const balanced = Math.abs(assetsTotal - (liabilitiesTotal + equityTotal)) < 0.02

  return {
    asOf: asOf.toISOString(),
    assets: assets.rows,
    assetsTotal: Math.round(assetsTotal * 100) / 100,
    liabilities: liabilities.rows,
    liabilitiesTotal: Math.round(liabilitiesTotal * 100) / 100,
    equity: equity.rows,
    equityTotal: Math.round(equityTotal * 100) / 100,
    isBalanced: balanced,
    equation: {
      assets: Math.round(assetsTotal * 100) / 100,
      liabilitiesPlusEquity: Math.round((liabilitiesTotal + equityTotal) * 100) / 100,
    },
  }
}

export async function getCashFlowStatement(
  tenantId: string,
  startDate?: string,
  endDate?: string,
) {
  const period = parsePeriod(startDate, endDate)

  const accounts = await prisma.account.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, code: true, name: true, type: true, subtype: true },
  })

  type FlowRow = { code: string; name: string; amount: number }
  const operating: FlowRow[] = []
  const investing: FlowRow[] = []
  const financing: FlowRow[] = []

  for (const account of accounts) {
    const agg = await prisma.journalLine.aggregate({
      where: {
        accountId: account.id,
        journalEntry: {
          tenantId,
          status: 'POSTED',
          date: { gte: period.startDate, lte: period.endDate },
        },
      },
      _sum: { debit: true, credit: true },
    })
    const debit = toNumber(agg._sum.debit)
    const credit = toNumber(agg._sum.credit)
    if (debit === 0 && credit === 0) continue

    const net = signedBalance(account.type, debit, credit)
    const amount = Math.round(net * 100) / 100
    const row = { code: account.code, name: account.name, amount }

    if (account.subtype === 'INVENTORY' || account.subtype === 'COGS') {
      investing.push(row)
    } else if (account.type === 'EQUITY' || account.subtype === 'CAPITAL') {
      financing.push(row)
    } else if (
      account.type === 'REVENUE' ||
      account.type === 'EXPENSE' ||
      ['AR', 'AP', 'BANK', 'CASH'].includes(account.subtype ?? '')
    ) {
      operating.push(row)
    }
  }

  const sum = (rows: FlowRow[]) => Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100

  return {
    period: {
      start: period.startDate.toISOString(),
      end: period.endDate.toISOString(),
    },
    operating: { rows: operating, total: sum(operating) },
    investing: { rows: investing, total: sum(investing) },
    financing: { rows: financing, total: sum(financing) },
    netChange: Math.round((sum(operating) + sum(investing) + sum(financing)) * 100) / 100,
  }
}

export async function getARAgingReport(tenantId: string) {
  return getArAgingReport(tenantId)
}

export async function getAPAgingReport(tenantId: string) {
  return getApAgingReport(tenantId)
}

export async function getExpenseBreakdown(
  tenantId: string,
  startDate?: string,
  endDate?: string,
) {
  const period = parsePeriod(startDate, endDate)
  const { rows, total } = await aggregateAccountsByType(
    tenantId,
    ['EXPENSE'],
    period.startDate,
    period.endDate,
  )

  return {
    period: {
      start: period.startDate.toISOString(),
      end: period.endDate.toISOString(),
    },
    categories: rows.map((r) => ({
      ...r,
      percent: total ? Math.round((r.amount / total) * 1000) / 10 : 0,
    })),
    total,
  }
}

export async function getMonthlyRevenueVsExpenses(tenantId: string, months = 12) {
  const now = new Date()
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  rangeStart.setHours(0, 0, 0, 0)

  // Single grouped query instead of ~months × accounts aggregates.
  const rows = await prisma.$queryRaw<
    Array<{ month: Date; type: AccountType; debit: Prisma.Decimal | number; credit: Prisma.Decimal | number }>
  >`
    SELECT
      date_trunc('month', je.date)::timestamp AS month,
      a.type,
      COALESCE(SUM(jl.debit), 0) AS debit,
      COALESCE(SUM(jl.credit), 0) AS credit
    FROM journal_lines jl
    INNER JOIN journal_entries je ON je.id = jl."journalEntryId"
    INNER JOIN finance_accounts a ON a.id = jl."accountId"
    WHERE je."tenantId" = ${tenantId}
      AND je.status = 'POSTED'
      AND a."isActive" = true
      AND a.type IN ('REVENUE', 'EXPENSE')
      AND je.date >= ${rangeStart}
    GROUP BY 1, 2
    ORDER BY 1 ASC
  `

  const byMonth = new Map<string, { revenue: number; expenses: number }>()
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${start.getFullYear()}-${start.getMonth()}`
    byMonth.set(key, { revenue: 0, expenses: 0 })
  }

  for (const row of rows) {
    const monthDate = new Date(row.month)
    const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`
    const bucket = byMonth.get(key)
    if (!bucket) continue
    const amount = Math.abs(signedBalance(row.type, toNumber(row.debit), toNumber(row.credit)))
    if (row.type === 'REVENUE') bucket.revenue += amount
    else bucket.expenses += amount
  }

  const series: Array<{ month: string; revenue: number; expenses: number }> = []
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${start.getFullYear()}-${start.getMonth()}`
    const bucket = byMonth.get(key) ?? { revenue: 0, expenses: 0 }
    series.push({
      month: start.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      revenue: Math.round(bucket.revenue * 100) / 100,
      expenses: Math.round(bucket.expenses * 100) / 100,
    })
  }

  return series
}

export async function getFinanceDashboard(tenantId: string, _userId?: string) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = now.toISOString()

  const [pl, arAging, apAging, upcomingBills, monthlyTrend, bankAccount] = await Promise.all([
    getProfitAndLoss(tenantId, monthStart, monthEnd),
    getARAgingReport(tenantId),
    getAPAgingReport(tenantId),
    getUpcomingBills(tenantId, 14),
    getMonthlyRevenueVsExpenses(tenantId, 12),
    resolveAccount(tenantId, GL_ACCOUNTS.BANK.subtype, [...GL_ACCOUNTS.BANK.codes]).catch(() => null),
  ])

  const cashBalance = bankAccount
    ? await getAccountBalance(bankAccount.id, tenantId)
    : 0

  const insightParts: string[] = []
  if (pl.netIncome >= 0) {
    insightParts.push(
      `Net profit this month is ${pl.netIncome.toLocaleString()} USD (${pl.changePercent >= 0 ? '+' : ''}${pl.changePercent}% vs prior period).`,
    )
  } else {
    insightParts.push(
      `Operating at a net loss of ${Math.abs(pl.netIncome).toLocaleString()} USD this month — review expense categories.`,
    )
  }
  if (arAging.totalOutstanding > 0) {
    insightParts.push(
      `AR outstanding: ${arAging.totalOutstanding.toLocaleString()} USD across ${arAging.buckets.reduce((s, b) => s + b.count, 0)} open invoices.`,
    )
  }
  if (apAging.totalOutstanding > 0) {
    insightParts.push(
      `AP outstanding: ${apAging.totalOutstanding.toLocaleString()} USD — ${upcomingBills.length} bill(s) due in the next 14 days.`,
    )
  }
  if (pl.changePercent <= -15 && pl.previousPeriod.netIncome !== 0) {
    insightParts.push('Profitability is down sharply versus last month — check expense spikes and delayed collections.')
  }

  return {
    kpis: {
      monthlyRevenue: pl.revenueTotal,
      monthlyExpenses: pl.expenseTotal,
      netProfit: pl.netIncome,
      cashBalance: Math.round(cashBalance * 100) / 100,
      arOutstanding: arAging.totalOutstanding,
      apOutstanding: apAging.totalOutstanding,
    },
    monthlyTrend,
    arAging,
    apAging,
    upcomingBills,
    aiInsight: insightParts.join(' '),
  }
}

export function exportReportCsv(title: string, rows: Record<string, unknown>[]): string {
  if (!rows.length) return `${title}\n(no data)\n`
  const headers = Object.keys(rows[0])
  const lines = [
    title,
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h]
        const str = val == null ? '' : String(val)
        return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str
      }).join(','),
    ),
  ]
  return lines.join('\n')
}

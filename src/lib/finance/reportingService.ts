import type { AccountType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { FinanceAgent } from '@/lib/agents/FinanceAgent'
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

async function aggregateAccountsByType(
  tenantId: string,
  types: AccountType[],
  startDate: Date,
  endDate: Date,
) {
  const accounts = await prisma.account.findMany({
    where: { tenantId, type: { in: types }, isActive: true },
    orderBy: { code: 'asc' },
  })

  const rows: Array<{ accountId: string; code: string; name: string; type: AccountType; amount: number }> = []
  let total = 0

  for (const account of accounts) {
    const agg = await prisma.journalLine.aggregate({
      where: {
        accountId: account.id,
        journalEntry: {
          tenantId,
          status: 'POSTED',
          date: { gte: startDate, lte: endDate },
        },
      },
      _sum: { debit: true, credit: true },
    })
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
  })

  const rows: Array<{ accountId: string; code: string; name: string; type: AccountType; balance: number }> = []
  let total = 0

  for (const account of accounts) {
    const balance = await getAccountBalance(account.id, tenantId, asOfDate)
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
  const series: Array<{ month: string; revenue: number; expenses: number }> = []

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const [rev, exp] = await Promise.all([
      aggregateAccountsByType(tenantId, ['REVENUE'], start, end),
      aggregateAccountsByType(tenantId, ['EXPENSE'], start, end),
    ])
    series.push({
      month: start.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      revenue: rev.total,
      expenses: exp.total,
    })
  }

  return series
}

export async function getFinanceDashboard(tenantId: string, userId?: string) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = now.toISOString()

  const [
    pl,
    arAging,
    apAging,
    upcomingBills,
    monthlyTrend,
    bankAccount,
  ] = await Promise.all([
    getProfitAndLoss(tenantId, monthStart, monthEnd),
    getARAgingReport(tenantId),
    getAPAgingReport(tenantId),
    getUpcomingBills(tenantId, 14),
    getMonthlyRevenueVsExpenses(tenantId, 12),
    resolveAccount(tenantId, GL_ACCOUNTS.BANK.subtype, [...GL_ACCOUNTS.BANK.codes]).catch(() => null),
  ])

  let cashBalance = 0
  if (bankAccount) {
    cashBalance = await getAccountBalance(bankAccount.id, tenantId)
  }

  const agent = new FinanceAgent(tenantId, userId)
  const [revenueInsight, expenseInsight, cashflowInsight] = await Promise.all([
    agent.getRevenue('this month'),
    agent.getExpenses('this month'),
    agent.getCashflow(),
  ])

  const insightParts: string[] = []
  if (pl.netIncome >= 0) {
    insightParts.push(`Net profit this month is ${pl.netIncome.toLocaleString()} USD (${pl.changePercent >= 0 ? '+' : ''}${pl.changePercent}% vs prior period).`)
  } else {
    insightParts.push(`Operating at a net loss of ${Math.abs(pl.netIncome).toLocaleString()} USD this month — review expense categories.`)
  }
  if (arAging.totalOutstanding > 0) {
    insightParts.push(`AR outstanding: ${arAging.totalOutstanding.toLocaleString()} USD across ${arAging.buckets.reduce((s, b) => s + b.count, 0)} open invoices.`)
  }
  if (apAging.totalOutstanding > 0) {
    insightParts.push(`AP outstanding: ${apAging.totalOutstanding.toLocaleString()} USD — ${upcomingBills.length} bill(s) due in the next 14 days.`)
  }
  if (expenseInsight.anomalies?.length) {
    insightParts.push(String(expenseInsight.anomalies[0]?.reason ?? 'Expense anomaly detected vs prior period.'))
  }
  if (cashflowInsight.alerts?.length) {
    insightParts.push(String(cashflowInsight.alerts[0]))
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
    agentMetrics: {
      revenue: revenueInsight,
      expenses: expenseInsight,
      cashflow: cashflowInsight,
    },
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

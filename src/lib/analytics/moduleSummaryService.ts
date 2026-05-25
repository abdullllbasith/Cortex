import { DealStatus, InvoiceStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { getApAgingReport } from '@/lib/finance/billService'
import { getArAgingReport } from '@/lib/finance/invoiceService'
import { getProfitAndLoss } from '@/lib/finance/reportingService'
import { getAccountBalance } from '@/lib/finance/journalEngine'
import { GL_ACCOUNTS, resolveAccount } from '@/lib/finance/accountResolver'
import { calculatePipelineValue } from '@/lib/crm/pipelineService'
import { getHrDashboard } from '@/lib/hr/hrDashboardService'
import { estimatePayroll } from '@/lib/hr/payrollService'
import { resolveDateRange } from './periodUtils'

function toNumber(v: { toNumber(): number } | number | null | undefined): number {
  if (v == null) return 0
  return typeof v === 'number' ? v : v.toNumber()
}

export interface FinanceModuleSummary {
  monthlyRevenue: number
  monthlyExpenses: number
  netProfit: number
  grossMargin: number
  arTotal: number
  apTotal: number
  cashBalance: number
}

export interface HrModuleSummary {
  totalEmployees: number
  onLeaveToday: number
  attendanceRateThisMonth: number
  pendingLeaveRequests: number
  nextPayrollDate: string
  totalPayrollCost: number
}

export interface CrmModuleSummary {
  totalContacts: number
  openDeals: number
  pipelineValue: number
  wonThisMonth: number
  conversionRate: number
  avgDealSize: number
  overdueFollowUps: number
}

export async function getFinanceModuleSummary(tenantId: string): Promise<FinanceModuleSummary> {
  const range = resolveDateRange('month')
  const startDate = range.start.toISOString().slice(0, 10)
  const endDate = range.end.toISOString().slice(0, 10)

  const [pnl, ar, ap] = await Promise.all([
    getProfitAndLoss(tenantId, startDate, endDate),
    getArAgingReport(tenantId),
    getApAgingReport(tenantId),
  ])

  let cashBalance = 0
  try {
    const cashAccount = await resolveAccount(tenantId, GL_ACCOUNTS.BANK.subtype, [...GL_ACCOUNTS.BANK.codes])
    cashBalance = await getAccountBalance(cashAccount.id, tenantId, range.end)
  } catch {
    cashBalance = 0
  }

  const grossMargin =
    pnl.revenueTotal > 0
      ? Math.round(((pnl.revenueTotal - pnl.expenseTotal) / pnl.revenueTotal) * 1000) / 10
      : 0

  return {
    monthlyRevenue: Math.round(pnl.revenueTotal * 100) / 100,
    monthlyExpenses: Math.round(pnl.expenseTotal * 100) / 100,
    netProfit: Math.round(pnl.netIncome * 100) / 100,
    grossMargin,
    arTotal: Math.round(ar.totalOutstanding * 100) / 100,
    apTotal: Math.round(ap.totalOutstanding * 100) / 100,
    cashBalance: Math.round(cashBalance * 100) / 100,
  }
}

export async function getHrModuleSummary(tenantId: string): Promise<HrModuleSummary> {
  const dashboard = await getHrDashboard(tenantId)
  const today = new Date()
  const payrollMonth = today.getMonth() + 1
  const payrollYear = today.getFullYear()

  let totalPayrollCost = dashboard.payrollSummary.lastRun?.totalNet ?? 0
  try {
    const estimate = await estimatePayroll(tenantId, payrollMonth, payrollYear)
    if (estimate.estimatedTotalNet > 0) totalPayrollCost = estimate.estimatedTotalNet
  } catch {
    // keep last run value
  }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const attendanceRecords = await prisma.attendance.findMany({
    where: { tenantId, date: { gte: monthStart, lte: today } },
    select: { status: true },
  })
  let present = 0
  for (const r of attendanceRecords) {
    if (r.status === 'PRESENT' || r.status === 'LATE') present += 1
    else if (r.status === 'HALF_DAY') present += 0.5
  }
  const attendanceRateThisMonth =
    attendanceRecords.length > 0 ? Math.round((present / attendanceRecords.length) * 1000) / 10 : 0

  return {
    totalEmployees: dashboard.kpis.totalEmployees,
    onLeaveToday: dashboard.kpis.onLeaveToday,
    attendanceRateThisMonth,
    pendingLeaveRequests: dashboard.kpis.pendingLeaveApprovals ?? 0,
    nextPayrollDate: dashboard.kpis.nextPayrollDate,
    totalPayrollCost: Math.round(totalPayrollCost * 100) / 100,
  }
}

export async function getCrmModuleSummary(tenantId: string): Promise<CrmModuleSummary> {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [
    totalContacts,
    openDeals,
    pipeline,
    wonThisMonth,
    closedDeals,
    overdueFollowUps,
  ] = await Promise.all([
    prisma.crmContact.count({ where: { tenantId, isActive: true } }),
    prisma.crmDeal.count({ where: { tenantId, status: DealStatus.OPEN } }),
    calculatePipelineValue(tenantId),
    prisma.crmDeal.aggregate({
      where: { tenantId, status: DealStatus.WON, wonAt: { gte: monthStart } },
      _sum: { value: true },
    }),
    prisma.crmDeal.findMany({
      where: { tenantId, status: { in: [DealStatus.WON, DealStatus.LOST] } },
      select: { status: true, value: true },
    }),
    prisma.crmContact.count({
      where: { tenantId, isActive: true, nextFollowUpAt: { lt: new Date() } },
    }),
  ])

  const wonCount = closedDeals.filter((d) => d.status === DealStatus.WON).length
  const lostCount = closedDeals.filter((d) => d.status === DealStatus.LOST).length
  const conversionRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 1000) / 10 : 0
  const avgDealSize =
    closedDeals.length > 0
      ? Math.round(
          (closedDeals.reduce((s, d) => s + toNumber(d.value), 0) / closedDeals.length) * 100,
        ) / 100
      : 0

  return {
    totalContacts,
    openDeals,
    pipelineValue: Math.round(pipeline.totalValue * 100) / 100,
    wonThisMonth: Math.round(toNumber(wonThisMonth._sum.value) * 100) / 100,
    conversionRate,
    avgDealSize,
    overdueFollowUps,
  }
}

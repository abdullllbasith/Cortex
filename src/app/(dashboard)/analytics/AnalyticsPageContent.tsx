'use client'

import { Suspense, useState } from 'react'
import {
  Sparkles,
  DollarSign,
  Users,
  Package,
  Wallet,
  Briefcase,
  Target,
  BarChart3,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ResponsiveContainer as PageContainer } from '@/components/layout/ResponsiveContainer'
import {
  KPIScorecard,
  RevenueChart,
  CustomerFunnelChart,
  InventoryHealthGrid,
  SupplierRadarChart,
  AnalyticsDateRangePicker,
  ExportMenu,
} from '@/components/analytics'
import { Skeleton } from '@/components/ui'
import {
  useExecutiveAnalytics,
  useSalesAnalytics,
  useCustomerAnalytics,
  useInventoryAnalytics,
  useFinanceAnalytics,
  useHrAnalytics,
  useCrmAnalytics,
} from '@/lib/api/hooks/useAnalytics'
import { useSearchParams } from 'next/navigation'
import type { AnalyticsPeriod } from '@/lib/analytics/periodUtils'

type TabId = 'overview' | 'finance' | 'hr' | 'crm'

const TABS: { id: TabId; label: string; icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'hr', label: 'HR', icon: Briefcase },
  { id: 'crm', label: 'CRM', icon: Target },
]

function MetricTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: typeof DollarSign; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-5 h-5 text-indigo-600" />
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
    </div>
  )
}

function AnalyticsDashboard() {
  const [tab, setTab] = useState<TabId>('overview')
  const searchParams = useSearchParams()
  const period = (searchParams.get('period') ?? 'month') as AnalyticsPeriod
  const startDate = searchParams.get('startDate') ?? undefined
  const endDate = searchParams.get('endDate') ?? undefined
  const queryParams = { period, startDate, endDate }

  const executive = useExecutiveAnalytics({ ...queryParams, period, startDate, endDate })
  const sales = useSalesAnalytics({ ...queryParams, granularity: 'day' })
  const customers = useCustomerAnalytics(queryParams)
  const inventory = useInventoryAnalytics(queryParams)
  const finance = useFinanceAnalytics(queryParams)
  const hr = useHrAnalytics(queryParams)
  const crm = useCrmAnalytics()

  const { data, error, isLoading } = executive
  const finDetails = finance.data?.details
  const hrDetails = hr.data?.details
  const crmDetails = crm.data?.details as {
    winRateByStage?: Array<{ stageId: string; winRate: number }>
    avgTimePerStage?: Array<{ stageId: string; avgDays: number }>
  } | undefined

  const scorecard = data?.scorecard ?? []
  const findScore = (metric: string) => scorecard.find((s) => s.metric === metric)

  const kpis = data
    ? [
        {
          id: 'revenue',
          label: 'Revenue',
          value: sales.data?.summary.totalRevenue ?? findScore('Revenue')?.value ?? 0,
          change: sales.data?.comparison.revenueChange ?? findScore('Revenue')?.change ?? 0,
          prefix: '$',
          sparkline: sales.data?.timeseries.map((r) => r.revenue) ?? data.revenueChart?.map((r) => r.revenue),
          rag: findScore('Revenue')?.rag as 'green' | 'amber' | 'red' | undefined,
        },
        {
          id: 'orders',
          label: 'Orders',
          value: sales.data?.summary.totalOrders ?? findScore('Orders')?.value ?? 0,
          change: sales.data?.comparison.ordersChange ?? findScore('Orders')?.change ?? 0,
          sparkline: sales.data?.timeseries.map((r) => r.orders) ?? data.revenueChart?.map((r) => r.revenue / 100),
          rag: findScore('Orders')?.rag as 'green' | 'amber' | 'red' | undefined,
        },
        {
          id: 'customers',
          label: 'Customers',
          value: (customers.data?.metrics.newCustomers ?? 0) + (customers.data?.metrics.returningCustomers ?? 0),
          change: customers.data?.metrics.retentionRate ?? 0,
          rag: findScore('Customers')?.rag as 'green' | 'amber' | 'red' | undefined,
        },
        {
          id: 'gross-margin',
          label: 'Gross Margin',
          value: sales.data?.summary.grossMarginPct ?? findScore('Gross Margin')?.value ?? 0,
          change: 0,
          suffix: '%',
          sparkline: sales.data?.timeseries.map((r) => r.marginPct) ?? data.revenueChart?.map((r) => r.marginPct),
          rag: findScore('Gross Margin')?.rag as 'green' | 'amber' | 'red' | undefined,
        },
      ]
    : []

  const txRows = (data?.transactions ?? []).map((t) => ({
    id: String(t.id ?? ''),
    product: String(t.productName ?? t.productId ?? ''),
    revenue: Number(t.revenue ?? 0),
    date: String(t.timestamp ?? '').slice(0, 10),
  }))

  const salesChart =
    sales.data?.timeseries.map((t) => ({
      date: t.date.slice(5, 10),
      revenue: t.revenue,
      marginPct: t.marginPct,
    })) ?? data?.revenueChart ?? []

  const pnlChart = finDetails
    ? [
        { name: 'Revenue', value: finDetails.profitAndLoss.revenueTotal },
        { name: 'Expenses', value: finDetails.profitAndLoss.expenseTotal },
        { name: 'Net', value: finDetails.profitAndLoss.netIncome },
      ]
    : finance.data
      ? [
          { name: 'Revenue', value: finance.data.monthlyRevenue },
          { name: 'Expenses', value: finance.data.monthlyExpenses },
          { name: 'Net', value: finance.data.netProfit },
        ]
      : []

  const headcountTrend = hrDetails?.headcount.trend ?? []

  const crmFunnel = crm.data
    ? [
        { stage: 'Contacts', count: crm.data.totalContacts },
        { stage: 'Open deals', count: crm.data.openDeals },
        { stage: 'Won MTD', count: Math.round(crm.data.wonThisMonth / (crm.data.avgDealSize || 1)) || 0 },
      ]
    : []

  return (
    <PageContainer className="flex-1 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <AnalyticsDateRangePicker />
          <ExportMenu filename="executive-analytics" title="Executive Analytics" rows={txRows} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          Failed to load analytics. Ensure the database is seeded and migrations are applied.
        </div>
      )}

      {tab === 'overview' && (
        <>
          <KPIScorecard metrics={kpis} loading={isLoading || sales.isLoading} />
          {data?.insight?.summary && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/30 p-4 flex gap-3">
              <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                  AI Executive Summary
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{data.insight.summary}</p>
              </div>
            </div>
          )}
          <section>
            <SectionHeader icon={DollarSign} title="Sales Performance" />
            <RevenueChart data={salesChart} loading={sales.isLoading} />
          </section>
          <section>
            <SectionHeader icon={Package} title="Inventory Health" />
            <InventoryHealthGrid
              fastMovers={inventory.data?.metrics.fastMovers ?? data?.modules?.inventory?.fastMovers ?? []}
              deadStock={inventory.data?.metrics.deadStock ?? data?.modules?.inventory?.deadStock ?? []}
              reorderRequired={inventory.data?.metrics.reorderRequired ?? data?.modules?.inventory?.reorderRequired ?? []}
              loading={inventory.isLoading}
            />
          </section>
          <section>
            <SectionHeader icon={Users} title="Customer Analytics" />
            <CustomerFunnelChart
              data={customers.data?.funnel ?? data?.funnel ?? { visitors: 0, leads: 0, customers: 0, repeat: 0 }}
              loading={customers.isLoading}
            />
          </section>
          <section>
            <SectionHeader icon={Sparkles} title="Supplier Performance" />
            <SupplierRadarChart data={data?.supplierRadar ?? []} loading={isLoading} />
          </section>
        </>
      )}

      {tab === 'finance' && (
        <div className="space-y-6">
          {finance.isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : finance.data ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <MetricTile label="Revenue" value={`$${Math.round(finance.data.monthlyRevenue).toLocaleString()}`} />
                <MetricTile label="Expenses" value={`$${Math.round(finance.data.monthlyExpenses).toLocaleString()}`} />
                <MetricTile label="Net profit" value={`$${Math.round(finance.data.netProfit).toLocaleString()}`} />
                <MetricTile label="Gross margin" value={`${finance.data.grossMargin}%`} />
                <MetricTile label="AR total" value={`$${Math.round(finance.data.arTotal).toLocaleString()}`} />
                <MetricTile label="AP total" value={`$${Math.round(finance.data.apTotal).toLocaleString()}`} />
                <MetricTile label="Cash balance" value={`$${Math.round(finance.data.cashBalance).toLocaleString()}`} />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <h3 className="font-semibold mb-4">P&amp;L summary</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={pnlChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(v) => [`$${Number(v ?? 0).toLocaleString()}`, '']} />
                      <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {finDetails && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                    <h3 className="font-semibold mb-4">AR aging</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={finDetails.accountsReceivable.buckets} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                        <YAxis type="category" dataKey="label" width={80} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="total" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              {finDetails && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <h3 className="font-semibold mb-4">AP aging</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={finDetails.accountsPayable.buckets}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis tickFormatter={(v) => `$${v}`} />
                      <Tooltip />
                      <Bar dataKey="total" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">Finance data unavailable — seed chart of accounts first.</p>
          )}
        </div>
      )}

      {tab === 'hr' && (
        <div className="space-y-6">
          {hr.isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : hr.data ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricTile label="Employees" value={String(hr.data.totalEmployees)} />
                <MetricTile label="On leave today" value={String(hr.data.onLeaveToday)} />
                <MetricTile label="Attendance (month)" value={`${hr.data.attendanceRateThisMonth}%`} />
                <MetricTile label="Pending leave" value={String(hr.data.pendingLeaveRequests)} />
                <MetricTile
                  label="Next payroll"
                  value={new Date(hr.data.nextPayrollDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                />
                <MetricTile label="Payroll cost" value={`$${Math.round(hr.data.totalPayrollCost).toLocaleString()}`} />
              </div>
              {headcountTrend.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <h3 className="font-semibold mb-4">Headcount trend (12 months)</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={headcountTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {hrDetails && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <h3 className="font-semibold mb-2">Attendance rate (period)</h3>
                  <p className="text-3xl font-semibold">{hrDetails.attendance.rate}%</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {hrDetails.attendance.presentDays} present days logged across {hrDetails.attendance.recordsLogged}{' '}
                    records
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">HR data unavailable</p>
          )}
        </div>
      )}

      {tab === 'crm' && (
        <div className="space-y-6">
          {crm.isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : crm.data ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <MetricTile label="Contacts" value={String(crm.data.totalContacts)} />
                <MetricTile label="Open deals" value={String(crm.data.openDeals)} />
                <MetricTile label="Pipeline" value={`$${Math.round(crm.data.pipelineValue).toLocaleString()}`} />
                <MetricTile label="Won this month" value={`$${Math.round(crm.data.wonThisMonth).toLocaleString()}`} />
                <MetricTile label="Conversion" value={`${crm.data.conversionRate}%`} />
                <MetricTile label="Avg deal size" value={`$${Math.round(crm.data.avgDealSize).toLocaleString()}`} />
                <MetricTile label="Overdue follow-ups" value={String(crm.data.overdueFollowUps)} />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <h3 className="font-semibold mb-4">Pipeline funnel</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={crmFunnel} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="stage" width={90} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {crmDetails?.avgTimePerStage && crmDetails.avgTimePerStage.length > 0 && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                    <h3 className="font-semibold mb-4">Deal velocity (avg days in stage)</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={crmDetails.avgTimePerStage}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="stageId" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="avgDays" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">CRM data unavailable</p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Recent sales events</h3>
        </div>
        {isLoading ? (
          <Skeleton className="h-48 m-4" />
        ) : txRows.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">No transactions in this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-4 py-2 font-medium">ID</th>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 font-medium">Revenue</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {txRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-2 font-mono text-xs">{row.id.slice(0, 8)}</td>
                    <td className="px-4 py-2">{row.product}</td>
                    <td className="px-4 py-2">${row.revenue.toLocaleString()}</td>
                    <td className="px-4 py-2 text-slate-500">{row.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  )
}

export function AnalyticsPageContent() {
  return (
    <Suspense fallback={<Skeleton className="h-96 m-6 rounded-xl" />}>
      <AnalyticsDashboard />
    </Suspense>
  )
}

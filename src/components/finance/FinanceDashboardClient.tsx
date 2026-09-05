'use client'

import dynamic from 'next/dynamic'
import useSWR from 'swr'
import Link from 'next/link'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  FileText,
  Receipt,
  Bot,
  ArrowRight,
  Calendar,
} from 'lucide-react'
import { PageHeader, Card, CardBody, Badge, Skeleton, Button } from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'

const FinanceDashboardCharts = dynamic(
  () => import('./FinanceDashboardCharts').then((m) => m.FinanceDashboardCharts),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-6">
        <Skeleton className="h-[320px] w-full rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    ),
  },
)

interface DashboardData {
  kpis: {
    monthlyRevenue: number
    monthlyExpenses: number
    netProfit: number
    cashBalance: number
    arOutstanding: number
    apOutstanding: number
  }
  monthlyTrend: Array<{ month: string; revenue: number; expenses: number }>
  arAging: { buckets: Array<{ label: string; count: number; total: number }>; totalOutstanding: number }
  apAging: { buckets: Array<{ label: string; count: number; total: number }>; totalOutstanding: number }
  upcomingBills: Array<{
    id: string
    billNumber: string
    supplierName: string
    dueDate: string
    amountDue: number
    currency: string
    status: string
  }>
  aiInsight: string
}

function formatMoney(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  href,
  loading,
}: {
  label: string
  value: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
  href?: string
  loading?: boolean
}) {
  const inner = (
    <Card className={href ? 'cursor-pointer hover:border-indigo-300 transition-colors h-full' : 'h-full'}>
      <CardBody className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5">
          <Icon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-slate-500 truncate">{label}</p>
          {loading ? (
            <Skeleton className="mt-1 h-7 w-24" />
          ) : (
            <p className="font-display text-xl font-semibold tabular-nums">{value}</p>
          )}
          {!loading && trend === 'up' && <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5" />}
          {!loading && trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500 mt-0.5" />}
        </div>
      </CardBody>
    </Card>
  )
  if (href) return <Link href={href}>{inner}</Link>
  return inner
}

export function FinanceDashboardClient() {
  const { data, isLoading } = useSWR<DashboardData>('/finance/dashboard', swrFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  })

  const kpis = data?.kpis
  const netTrend = (kpis?.netProfit ?? 0) >= 0 ? 'up' : 'down'
  const showValues = Boolean(data)

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Finance"
        subtitle="Revenue, expenses, cash position, and payables"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Finance' },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/finance/invoices/new">
              <Button size="sm">New Invoice</Button>
            </Link>
            <Link href="/finance/invoices">
              <Button variant="secondary" size="sm">Record Payment</Button>
            </Link>
            <Link href="/finance/reports">
              <Button variant="secondary" size="sm">View Reports</Button>
            </Link>
          </div>
        }
      />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Monthly Revenue" value={formatMoney(kpis?.monthlyRevenue ?? 0)} icon={DollarSign} trend="up" href="/finance/reports?report=pl" loading={isLoading && !showValues} />
          <KpiCard label="Monthly Expenses" value={formatMoney(kpis?.monthlyExpenses ?? 0)} icon={Receipt} trend="down" href="/finance/reports?report=pl" loading={isLoading && !showValues} />
          <KpiCard label="Net Profit" value={formatMoney(kpis?.netProfit ?? 0)} icon={TrendingUp} trend={netTrend} href="/finance/reports?report=pl" loading={isLoading && !showValues} />
          <KpiCard label="Cash Balance" value={formatMoney(kpis?.cashBalance ?? 0)} icon={Wallet} href="/finance/accounts" loading={isLoading && !showValues} />
          <KpiCard label="AR Outstanding" value={formatMoney(kpis?.arOutstanding ?? 0)} icon={FileText} href="/finance/invoices" loading={isLoading && !showValues} />
          <KpiCard label="AP Outstanding" value={formatMoney(kpis?.apOutstanding ?? 0)} icon={Receipt} href="/finance/reports?report=ap-aging" loading={isLoading && !showValues} />
        </div>

        {showValues ? (
          <FinanceDashboardCharts
            monthlyTrend={data?.monthlyTrend ?? []}
            arAging={data?.arAging ?? { buckets: [], totalOutstanding: 0 }}
            apAging={data?.apAging ?? { buckets: [], totalOutstanding: 0 }}
          />
        ) : (
          <div className="space-y-6">
            <Skeleton className="h-[320px] w-full rounded-xl" />
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardBody className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-sm font-semibold">Bills due in 14 days</h3>
                </div>
              </div>
              {isLoading && !showValues ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : !data?.upcomingBills.length ? (
                <p className="text-sm text-slate-500">No bills due in the next two weeks.</p>
              ) : (
                <ul className="space-y-3">
                  {data.upcomingBills.map((bill) => (
                    <li key={bill.id} className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium">{bill.billNumber}</p>
                        <p className="text-xs text-slate-500">{bill.supplierName} · Due {new Date(bill.dueDate).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{formatMoney(bill.amountDue, bill.currency)}</p>
                        <Badge variant={bill.status === 'OVERDUE' ? 'danger' : 'warning'}>{bill.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card className="border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20">
            <CardBody className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <Bot className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-semibold">Finance Agent Insight</h3>
              </div>
              {isLoading && !showValues ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {data?.aiInsight || 'No finance insights yet — record invoices and payments to populate this view.'}
                </p>
              )}
              <Link href="/assistant" className="mt-4 inline-flex items-center text-sm text-indigo-600 hover:underline">
                Ask Finance Agent <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

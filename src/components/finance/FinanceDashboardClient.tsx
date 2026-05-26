'use client'

import useSWR from 'swr'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
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

const AGING_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444']

function formatMoney(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  href,
}: {
  label: string
  value: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
  href?: string
}) {
  const inner = (
    <Card className={href ? 'cursor-pointer hover:border-indigo-300 transition-colors h-full' : 'h-full'}>
      <CardBody className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5">
          <Icon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-slate-500 truncate">{label}</p>
          <p className="font-display text-xl font-semibold tabular-nums">{value}</p>
          {trend === 'up' && <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5" />}
          {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500 mt-0.5" />}
        </div>
      </CardBody>
    </Card>
  )
  if (href) return <Link href={href}>{inner}</Link>
  return inner
}

function AgingDonut({
  title,
  data,
  total,
}: {
  title: string
  data: Array<{ label: string; count: number; total: number }>
  total: number
}) {
  const chartData = data.filter((d) => d.total > 0).map((d) => ({ name: d.label, value: d.total }))
  const empty = chartData.length === 0

  return (
    <Card>
      <CardBody className="p-5">
        <h3 className="mb-1 text-sm font-semibold">{title}</h3>
        <p className="mb-4 text-2xl font-semibold tabular-nums">{formatMoney(total)}</p>
        {empty ? (
          <p className="text-sm text-slate-500 py-8 text-center">No outstanding balance</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatMoney(Number(v ?? 0))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  )
}

export function FinanceDashboardClient() {
  const { data, isLoading } = useSWR<DashboardData>('/finance/dashboard', swrFetcher)

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  const kpis = data?.kpis
  const netTrend = (kpis?.netProfit ?? 0) >= 0 ? 'up' : 'down'

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
          <KpiCard label="Monthly Revenue" value={formatMoney(kpis?.monthlyRevenue ?? 0)} icon={DollarSign} trend="up" href="/finance/reports?report=pl" />
          <KpiCard label="Monthly Expenses" value={formatMoney(kpis?.monthlyExpenses ?? 0)} icon={Receipt} trend="down" href="/finance/reports?report=pl" />
          <KpiCard label="Net Profit" value={formatMoney(kpis?.netProfit ?? 0)} icon={TrendingUp} trend={netTrend} href="/finance/reports?report=pl" />
          <KpiCard label="Cash Balance" value={formatMoney(kpis?.cashBalance ?? 0)} icon={Wallet} href="/finance/accounts" />
          <KpiCard label="AR Outstanding" value={formatMoney(kpis?.arOutstanding ?? 0)} icon={FileText} href="/finance/invoices" />
          <KpiCard label="AP Outstanding" value={formatMoney(kpis?.apOutstanding ?? 0)} icon={Receipt} href="/finance/reports?report=ap-aging" />
        </div>

        <Card>
          <CardBody className="p-5">
            <h3 className="mb-4 text-sm font-semibold">Revenue vs Expenses (12 months)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data?.monthlyTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatMoney(Number(v ?? 0))} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <AgingDonut title="Accounts Receivable Aging" data={data?.arAging.buckets ?? []} total={data?.arAging.totalOutstanding ?? 0} />
          <AgingDonut title="Accounts Payable Aging" data={data?.apAging.buckets ?? []} total={data?.apAging.totalOutstanding ?? 0} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardBody className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-sm font-semibold">Bills due in 14 days</h3>
                </div>
              </div>
              {!data?.upcomingBills.length ? (
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
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {data?.aiInsight || 'Loading financial insights…'}
              </p>
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

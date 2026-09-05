'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardBody } from '@/components/ui'

const AGING_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444']

function formatMoney(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
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

export function FinanceDashboardCharts({
  monthlyTrend,
  arAging,
  apAging,
}: {
  monthlyTrend: Array<{ month: string; revenue: number; expenses: number }>
  arAging: { buckets: Array<{ label: string; count: number; total: number }>; totalOutstanding: number }
  apAging: { buckets: Array<{ label: string; count: number; total: number }>; totalOutstanding: number }
}) {
  return (
    <>
      <Card>
        <CardBody className="p-5">
          <h3 className="mb-4 text-sm font-semibold">Revenue vs Expenses (12 months)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyTrend}>
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
        <AgingDonut title="Accounts Receivable Aging" data={arAging.buckets} total={arAging.totalOutstanding} />
        <AgingDonut title="Accounts Payable Aging" data={apAging.buckets} total={apAging.totalOutstanding} />
      </div>
    </>
  )
}

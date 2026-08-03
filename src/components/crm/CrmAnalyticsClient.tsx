'use client'

import useSWR from 'swr'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { PageHeader, Card, CardBody, Badge, Avatar, Skeleton } from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher } from '@/lib/api/apiClient'
import { chartColors } from '@/styles/theme'

interface AnalyticsData {
  winRateByStage: Array<{ stageId: string; winRate: number; totalClosed: number }>
  avgTimePerStage: Array<{ stageId: string; avgDays: number }>
  lossReasonBreakdown: Array<{ reason: string; count: number }>
  leadSourcePerformance: Array<{ source: string; leads: number; converted: number; conversionRate: number }>
  repPerformance: Array<{
    ownerId: string
    name: string
    avatarUrl: string | null
    open: number
    won: number
    lost: number
    revenue: number
    winRate: number
  }>
}

interface RepRow extends Record<string, unknown> {
  ownerId: string
  name: string
  avatarUrl: string | null
  open: number
  won: number
  lost: number
  revenue: number
  winRate: number
}

export function CrmAnalyticsClient() {
  const { data, isLoading } = useSWR<AnalyticsData>('/crm/analytics', swrFetcher)

  const repColumns: ColumnDef<RepRow>[] = [
    {
      id: 'rep',
      header: 'Rep',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Avatar name={row.name} src={row.avatarUrl ?? undefined} size="xs" />
          <span>{row.name}</span>
        </div>
      ),
    },
    { id: 'open', header: 'Open', cell: ({ row }) => row.open },
    { id: 'won', header: 'Won', cell: ({ row }) => row.won },
    { id: 'revenue', header: 'Revenue', cell: ({ row }) => `$${row.revenue.toLocaleString()}` },
    {
      id: 'winRate',
      header: 'Win rate',
      cell: ({ row }) => `${row.winRate.toFixed(1)}%`,
    },
  ]

  const lossData = (data?.lossReasonBreakdown ?? []).map((r, i) => ({
    name: r.reason,
    value: r.count,
    fill: chartColors[i % chartColors.length],
  }))

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="CRM Analytics"
        subtitle="Win/loss analysis, lead sources, and rep performance"
        breadcrumbs={[
          { label: 'CRM', href: '/crm' },
          { label: 'Analytics' },
        ]}
        actions={
          <Link href="/crm">
            <Badge variant="default">Dashboard</Badge>
          </Link>
        }
      />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : data ? (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardBody className="p-4">
                  <h3 className="mb-4 text-sm font-semibold">Win rate by stage</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.winRateByStage}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="stageId" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `${v}%`} />
                        <Tooltip />
                        <Bar dataKey="winRate" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="p-4">
                  <h3 className="mb-4 text-sm font-semibold">Avg days per stage</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.avgTimePerStage}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="stageId" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="avgDays" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardBody className="p-4">
                  <h3 className="mb-4 text-sm font-semibold">Loss reason breakdown</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={lossData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {lossData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="p-4">
                  <h3 className="mb-4 text-sm font-semibold">Lead source performance</h3>
                  <div className="space-y-3">
                    {data.leadSourcePerformance.map((s) => (
                      <div key={s.source} className="flex items-center justify-between text-sm">
                        <div>
                          <Badge variant="default">{s.source.replace('_', ' ')}</Badge>
                          <span className="ml-2 text-slate-500">{s.leads} leads · {s.converted} converted</span>
                        </div>
                        <span className="font-medium text-indigo-600">{s.conversionRate.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardBody className="p-4">
                <h3 className="mb-4 text-sm font-semibold">Rep performance</h3>
                <DataTable columns={repColumns} data={data.repPerformance as RepRow[]} keyField="ownerId" />
              </CardBody>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  )
}

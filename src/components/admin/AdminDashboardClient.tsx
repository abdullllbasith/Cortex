'use client'

import useSWR from 'swr'
import Link from 'next/link'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Building2,
  DollarSign,
  Users,
  UserPlus,
  UserMinus,
  Cpu,
} from 'lucide-react'
import { PageHeader, Card, CardBody, Badge, Skeleton } from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'
import {
  PLAN_BADGE,
  PLAN_CHART_COLORS,
  PLAN_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/admin/adminUi'
import type { TenantPlan } from '@prisma/client'

interface OverviewData {
  overview: {
    totalTenants: number
    activeTenants: number
    MRR: number
    churnedThisMonth: number
    totalAICallsToday: number
  }
  planDistribution: Array<{ plan: TenantPlan; count: number; mrr: number }>
}

interface TenantRow {
  id: string
  name: string
  plan: TenantPlan
  createdAt: string
}

function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  sub?: string
}) {
  return (
    <Card>
      <CardBody className="flex items-start gap-4 p-5">
        <div className="rounded-lg bg-slate-100 p-2.5 dark:bg-slate-800">
          <Icon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
        </div>
      </CardBody>
    </Card>
  )
}

export function AdminDashboardClient() {
  const { data: overview, isLoading: overviewLoading } = useSWR<OverviewData>(
    '/admin/metrics/overview',
    swrFetcher,
  )
  const { data: mrrData } = useSWR<{ trend: Array<{ date: string; mrr: number }> }>(
    '/admin/metrics/mrr?days=90',
    swrFetcher,
  )
  const { data: signupData } = useSWR<{ trend: Array<{ date: string; signups: number }> }>(
    '/admin/metrics/signups?days=30',
    swrFetcher,
  )
  const { data: tech } = useSWR<{
    avgApiResponseTimeMs: number
    errorRate: number
    queueDepths: Record<string, number>
    webhookSuccessRate: number
    sampledRequests: number
  }>('/admin/metrics/tech', swrFetcher)
  const { data: recentTenants } = useSWR<{ items: TenantRow[] }>(
    '/admin/tenants?limit=10&sort=createdAt&order=desc',
    swrFetcher,
  )

  const ov = overview?.overview
  const newThisWeek =
    signupData?.trend?.reduce((s, p) => s + p.signups, 0) ?? 0
  const avgAiPerTenant =
    ov && ov.totalTenants > 0
      ? Math.round(ov.totalAICallsToday / ov.totalTenants)
      : 0

  const pieData =
    overview?.planDistribution
      ?.filter((p) => p.count > 0)
      .map((p) => ({
        name: PLAN_LABELS[p.plan],
        value: p.count,
        plan: p.plan,
      })) ?? []

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Platform Overview"
        subtitle="Real-time metrics across all tenants"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Dashboard' }]}
      />

      <div className="space-y-6 p-6">
        {overviewLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <KpiCard label="Total Tenants" value={ov?.totalTenants ?? 0} icon={Building2} />
            <KpiCard label="MRR" value={formatCurrency(ov?.MRR ?? 0)} icon={DollarSign} />
            <KpiCard label="Active Today" value={ov?.activeTenants ?? 0} icon={Users} />
            <KpiCard label="New This Week" value={newThisWeek} icon={UserPlus} />
            <KpiCard label="Churned This Month" value={ov?.churnedThisMonth ?? 0} icon={UserMinus} />
            <KpiCard label="Avg AI Calls/Tenant" value={avgAiPerTenant} icon={Cpu} sub="today" />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardBody className="p-6">
              <h2 className="font-display text-lg font-semibold">MRR Trend (90 days)</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mrrData?.trend ?? []}>
                    <defs>
                      <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => v.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v: number) => [`$${v}`, 'MRR']} />
                    <Area
                      type="monotone"
                      dataKey="mrr"
                      stroke="#6366f1"
                      fill="url(#mrrGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-6">
              <h2 className="font-display text-lg font-semibold">Plan Distribution</h2>
              <div className="mt-4 flex h-64 items-center justify-center">
                {pieData.length === 0 ? (
                  <p className="text-sm text-slate-500">No tenant data</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {pieData.map((entry) => (
                          <Cell
                            key={entry.plan}
                            fill={PLAN_CHART_COLORS[entry.plan as TenantPlan]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {pieData.map((p) => (
                  <span key={p.plan} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: PLAN_CHART_COLORS[p.plan as TenantPlan] }}
                    />
                    {p.name} ({p.value})
                  </span>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardBody className="p-6">
              <h2 className="font-display text-lg font-semibold">Signup Trend (30 days)</h2>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={signupData?.trend ?? []}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => v.slice(8)}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="signups" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-6">
              <h2 className="font-display text-lg font-semibold">Recent Signups</h2>
              <ul className="mt-4 space-y-3">
                {(recentTenants?.items ?? []).slice(0, 10).map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-slate-500">{formatDate(t.createdAt)}</p>
                      </div>
                      <Badge variant={PLAN_BADGE[t.plan]}>{PLAN_LABELS[t.plan]}</Badge>
                    </Link>
                  </li>
                ))}
                {(recentTenants?.items ?? []).length === 0 && (
                  <li className="text-sm text-slate-500">No recent signups</li>
                )}
              </ul>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody className="p-6">
            <h2 className="font-display text-lg font-semibold">Infrastructure Health</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <HealthMetric
                label="API Latency"
                value={tech ? `${tech.avgApiResponseTimeMs}ms` : '—'}
                ok={(tech?.avgApiResponseTimeMs ?? 0) < 500}
              />
              <HealthMetric
                label="Error Rate"
                value={tech ? `${tech.errorRate}%` : '—'}
                ok={(tech?.errorRate ?? 0) < 5}
              />
              <HealthMetric
                label="Agent Queue"
                value={
                  tech
                    ? `${tech.queueDepths.agentTasksPending} pending / ${tech.queueDepths.agentTasksProcessing} active`
                    : '—'
                }
                ok={(tech?.queueDepths.agentTasksPending ?? 0) < 50}
              />
              <HealthMetric
                label="Workflow Queue"
                value={
                  tech
                    ? `${tech.queueDepths.workflowExecutionsPending} pending / ${tech.queueDepths.workflowExecutionsRunning} running`
                    : '—'
                }
                ok={(tech?.queueDepths.workflowExecutionsRunning ?? 0) < 100}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Webhook success: {tech?.webhookSuccessRate ?? '—'}% · Sampled:{' '}
              {tech?.sampledRequests ?? 0} requests (24h)
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function HealthMetric({
  label,
  value,
  ok,
}: {
  label: string
  value: string
  ok: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold tabular-nums">{value}</p>
      <span
        className={`mt-2 inline-block text-xs font-medium ${ok ? 'text-emerald-600' : 'text-amber-600'}`}
      >
        {ok ? 'Healthy' : 'Attention'}
      </span>
    </div>
  )
}

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
  FunnelChart,
  Funnel,
  LabelList,
  Cell,
} from 'recharts'
import {
  Users,
  Briefcase,
  DollarSign,
  Trophy,
  TrendingUp,
  Percent,
  AlertCircle,
  ArrowRight,
  Phone,
} from 'lucide-react'
import { Card, CardBody, Badge, Skeleton, Button } from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'

interface DashboardData {
  kpis: {
    totalContacts: number
    openDeals: number
    pipelineValue: number
    wonThisMonth: number
    avgDealSize: number
    conversionRate: number
  }
  funnel: Array<{ stage: string; stageId: string; count: number; conversionPct: number | null }>
  revenueForecast: Array<{ month: string; expectedRevenue: number }>
  overdueFollowUps: Array<{
    id: string
    fullName: string
    company: string | null
    phone: string | null
    nextFollowUpAt: string | null
    ownerName: string | null
    dealValue: number
  }>
  activityFeed: Array<{
    id: string
    type: string
    subject: string
    contactName: string | null
    createdAt: string
    createdBy: string | null
  }>
  myOpenDeals: Array<{
    id: string
    title: string
    stageName: string
    value: number
    currency: string
    expectedCloseDate: string | null
    contactId: string | null
    contactName: string | null
  }>
}

const FUNNEL_COLORS = ['#94a3b8', '#6366f1', '#8b5cf6', '#f59e0b', '#10b981']

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function KpiCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
          <Icon className="h-5 w-5 text-indigo-500" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="font-display text-xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardBody>
    </Card>
  )
}

export function CrmDashboardClient() {
  const { data, isLoading } = useSWR<DashboardData>('/crm/dashboard', swrFetcher)

  const funnelData = (data?.funnel ?? []).map((s, i) => ({
    name: s.stage,
    value: Math.max(s.count, 1),
    count: s.count,
    conversionPct: s.conversionPct,
    fill: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
  }))

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <h1 className="text-xl font-semibold">CRM Dashboard</h1>
        <p className="text-sm text-slate-500">Pipeline health, forecasts, and team activity</p>
        <div className="mt-3 flex gap-2">
          <Link href="/crm/pipeline"><Badge variant="info">Pipeline</Badge></Link>
          <Link href="/crm/contacts"><Badge variant="default">Contacts</Badge></Link>
          <Link href="/crm/analytics"><Badge variant="default">Analytics</Badge></Link>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <KpiCard label="Total Contacts" value={String(data.kpis.totalContacts)} icon={Users} />
              <KpiCard label="Open Deals" value={String(data.kpis.openDeals)} icon={Briefcase} />
              <KpiCard label="Pipeline Value" value={formatMoney(data.kpis.pipelineValue)} icon={DollarSign} />
              <KpiCard label="Won This Month" value={formatMoney(data.kpis.wonThisMonth)} icon={Trophy} />
              <KpiCard label="Avg Deal Size" value={formatMoney(data.kpis.avgDealSize)} icon={TrendingUp} />
              <KpiCard label="Conversion Rate" value={`${data.kpis.conversionRate.toFixed(1)}%`} icon={Percent} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardBody className="p-4">
                  <h3 className="mb-2 text-sm font-semibold">Sales funnel</h3>
                  <p className="mb-4 text-xs text-slate-500">Lead → Contacted → Demo → Proposal → Won (open deals + won count)</p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {data.funnel.map((s, i) => (
                      <span key={s.stageId} className="text-xs text-slate-500">
                        {s.stage}: <strong>{s.count}</strong>
                        {i > 0 && s.conversionPct != null && (
                          <span className="ml-1 text-indigo-600">({s.conversionPct}%)</span>
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <FunnelChart>
                        <Tooltip formatter={(_, __, props) => [`${(props as { payload?: { count?: number } }).payload?.count ?? 0} deals`, 'Count']} />
                        <Funnel dataKey="value" data={funnelData} isAnimationActive>
                          <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" />
                          {funnelData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Funnel>
                      </FunnelChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="p-4">
                  <h3 className="mb-4 text-sm font-semibold">Revenue forecast (next 3 months)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.revenueForecast}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v) => [formatMoney(Number(v ?? 0)), 'Expected']} />
                        <Bar dataKey="expectedRevenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardBody className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <h3 className="text-sm font-semibold">Overdue follow-ups</h3>
                  </div>
                  {data.overdueFollowUps.length === 0 ? (
                    <p className="text-sm text-slate-500">All follow-ups are on track.</p>
                  ) : (
                    <ul className="space-y-2">
                      {data.overdueFollowUps.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                        >
                          <Link href={`/crm/contacts/${c.id}`} className="min-w-0 flex-1 text-sm hover:text-indigo-600">
                            <p className="font-medium truncate">{c.fullName}</p>
                            <p className="text-xs text-slate-500">
                              {formatMoney(c.dealValue)} pipeline
                              {c.nextFollowUpAt && ` · due ${new Date(c.nextFollowUpAt).toLocaleDateString()}`}
                            </p>
                          </Link>
                          {c.phone ? (
                            <a href={`tel:${c.phone}`}>
                              <Button size="sm" variant="secondary">
                                <Phone className="mr-1 h-3 w-3" />
                                Call now
                              </Button>
                            </a>
                          ) : (
                            <Link href={`/crm/contacts/${c.id}`}>
                              <Button size="sm" variant="secondary">Open</Button>
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>

              <Card className="lg:col-span-1">
                <CardBody className="p-4">
                  <h3 className="mb-3 text-sm font-semibold">My open deals</h3>
                  {data.myOpenDeals.length === 0 ? (
                    <p className="text-sm text-slate-500">No open deals assigned to you.</p>
                  ) : (
                    <ul className="space-y-2">
                      {data.myOpenDeals.map((d) => (
                        <li key={d.id}>
                          <Link
                            href={d.contactId ? `/crm/contacts/${d.contactId}` : '/crm/pipeline'}
                            className="block rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-indigo-300 dark:border-slate-700"
                          >
                            <p className="font-medium">{d.title}</p>
                            <p className="text-xs text-slate-500">
                              {d.stageName} · {formatMoney(d.value)}
                              {d.expectedCloseDate && ` · close ${new Date(d.expectedCloseDate).toLocaleDateString()}`}
                            </p>
                            {d.contactName && <p className="text-xs text-indigo-600">{d.contactName}</p>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>

              <Card className="lg:col-span-1">
                <CardBody className="p-4">
                  <h3 className="mb-3 text-sm font-semibold">Recent activity</h3>
                  <ul className="space-y-3">
                    {data.activityFeed.map((a) => (
                      <li key={a.id} className="flex items-start gap-2 text-sm">
                        <Badge variant="default" size="sm">{a.type}</Badge>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{a.subject}</p>
                          <p className="text-xs text-slate-500">
                            {a.contactName ?? 'Unknown'}
                            {a.createdBy && ` · ${a.createdBy}`}
                            {' · '}
                            {new Date(a.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Link href="/crm/contacts" className="mt-3 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                    View all contacts <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardBody>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

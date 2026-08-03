'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
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
import {
  Users,
  CalendarOff,
  UserPlus,
  Cake,
  Calendar,
  DollarSign,
  ArrowRight,
  Check,
  X,
  ClipboardList,
} from 'lucide-react'
import {
  PageHeader,
  Card,
  CardBody,
  Badge,
  Button,
  Skeleton,
  toast,
} from '@/components/ui'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'
import { ResponsiveContainer as PageContainer } from '@/components/layout/ResponsiveContainer'

interface DashboardData {
  kpis: {
    totalEmployees: number
    onLeaveToday: number
    newThisMonth: number
    upcomingAnniversaries: number
    nextPayrollDate: string
  }
  headcountByDepartment: Array<{ name: string; count: number }>
  attendanceTrend: Array<{ date: string; rate: number }>
  upcomingAnniversaries: Array<{ id: string; name: string; daysUntil: number; years: number }>
  pendingLeave: Array<{
    id: string
    employeeId: string
    employeeName: string
    leaveTypeName: string
    startDate: string
    endDate: string
    days: number
    reason: string | null
  }>
  payrollSummary: {
    lastRun: { id: string; month: number; year: number; status: string; totalNet: number } | null
    nextRunDate: string
    estimatedTotalNet: number
    eligibleEmployees: number
  }
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <Card>
      <CardBody className="flex items-start gap-3 p-4">
        <div className="rounded-lg bg-indigo-50 p-2 dark:bg-indigo-950">
          <Icon className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      </CardBody>
    </Card>
  )
}

export function HrDashboardClient() {
  const { data, error, isLoading, mutate } = useSWR<DashboardData>('/hr/dashboard', swrFetcher, {
    dedupingInterval: 30_000,
    errorRetryCount: 2,
  })
  const [acting, setActing] = useState<string | null>(null)

  async function approveLeave(id: string) {
    setActing(id)
    try {
      await apiClient.post(`/hr/leave/requests/${id}/approve`)
      toast.success('Leave approved')
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setActing(null)
    }
  }

  async function rejectLeave(id: string) {
    const reason = window.prompt('Rejection reason:')
    if (!reason?.trim()) return
    setActing(id)
    try {
      await apiClient.post(`/hr/leave/requests/${id}/reject`, { reason })
      toast.success('Leave rejected')
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rejection failed')
    } finally {
      setActing(null)
    }
  }

  const nextPayroll = useMemo(() => {
    if (!data?.kpis.nextPayrollDate) return '—'
    return new Date(data.kpis.nextPayrollDate).toLocaleDateString()
  }, [data])

  if (error && !data) {
    return (
      <PageContainer className="space-y-4 py-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <p className="font-medium">Could not load HR dashboard</p>
          <p className="mt-1">{error instanceof Error ? error.message : 'Request failed'}</p>
          <p className="mt-2 text-xs text-red-600/80 dark:text-red-400/80">
            If you recently added HR tables, restart the dev server after running{' '}
            <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">npx prisma generate</code>.
          </p>
          <Button className="mt-3" size="sm" onClick={() => void mutate()}>
            Retry
          </Button>
        </div>
      </PageContainer>
    )
  }

  if (isLoading || !data) {
    return (
      <PageContainer className="space-y-4 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </PageContainer>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="HR"
        subtitle="Workforce overview and people operations"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'HR' }]}
        actions={
          <div className="flex gap-2">
            <Link href="/hr/employees">
              <Button variant="secondary" size="sm">Employees</Button>
            </Link>
            <Link href="/hr/payroll">
              <Button size="sm">Payroll</Button>
            </Link>
          </div>
        }
      />

      <PageContainer className="flex-1 space-y-6 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard icon={Users} label="Total employees" value={data.kpis.totalEmployees} />
          <KpiCard icon={CalendarOff} label="On leave today" value={data.kpis.onLeaveToday} />
          <KpiCard icon={UserPlus} label="New this month" value={data.kpis.newThisMonth} />
          <KpiCard icon={ClipboardList} label="Pending leave approvals" value={data.pendingLeave.length} />
          <KpiCard icon={Calendar} label="Next payroll" value={nextPayroll} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardBody className="p-5">
              <h3 className="mb-4 font-semibold">Headcount by department</h3>
              {data.headcountByDepartment.length === 0 ? (
                <p className="text-sm text-slate-500">No departments yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.headcountByDepartment} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-5">
              <h3 className="mb-4 font-semibold">Attendance rate (30 days)</h3>
              {data.attendanceTrend.length === 0 ? (
                <p className="text-sm text-slate-500">No attendance data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.attendanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v) => [`${Number(v ?? 0)}%`, 'Rate']} />
                    <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardBody className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">Pending leave requests</h3>
                <Link href="/hr/leave" className="text-sm text-indigo-600 hover:underline">
                  View all <ArrowRight className="inline h-3 w-3" />
                </Link>
              </div>
              {data.pendingLeave.length === 0 ? (
                <p className="text-sm text-slate-500">No pending requests.</p>
              ) : (
                <div className="space-y-3">
                  {data.pendingLeave.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                    >
                      <div>
                        <Link href={`/hr/employees/${req.employeeId}`} className="font-medium hover:text-indigo-600">
                          {req.employeeName}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {req.leaveTypeName} · {req.days} day(s) ·{' '}
                          {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" loading={acting === req.id} onClick={() => approveLeave(req.id)}>
                          <Check className="mr-1 h-3 w-3" /> Approve
                        </Button>
                        <Button size="sm" variant="secondary" disabled={acting === req.id} onClick={() => rejectLeave(req.id)}>
                          <X className="mr-1 h-3 w-3" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4 p-5">
              <h3 className="font-semibold">Payroll summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Next run</span>
                  <span>{new Date(data.payrollSummary.nextRunDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Eligible employees</span>
                  <span>{data.payrollSummary.eligibleEmployees}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Est. total net</span>
                  <span className="font-semibold tabular-nums">
                    ${data.payrollSummary.estimatedTotalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {data.payrollSummary.lastRun && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Last run</span>
                    <span>
                      {data.payrollSummary.lastRun.month}/{data.payrollSummary.lastRun.year}{' '}
                      <Badge variant={data.payrollSummary.lastRun.status === 'APPROVED' ? 'success' : 'warning'} size="sm">
                        {data.payrollSummary.lastRun.status}
                      </Badge>
                    </span>
                  </div>
                )}
              </div>
              <Link href="/hr/payroll">
                <Button className="w-full" size="sm">
                  <DollarSign className="mr-1.5 h-4 w-4" /> Manage payroll
                </Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      </PageContainer>
    </div>
  )
}

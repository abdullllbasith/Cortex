'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Badge,
  Input,
  Textarea,
  toast,
} from '@/components/ui'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'

interface LeaveRequestItem {
  id: string
  employeeId: string
  employeeName: string
  employeeNumber: string
  departmentName: string | null
  leaveTypeName: string
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: string
  createdAt: string
}

interface LeaveRequestsResponse {
  items: LeaveRequestItem[]
}

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return monthKey(d)
}

function buildCalendarDays(month: string) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  const days: string[] = []
  for (let d = 1; d <= last; d++) {
    days.push(`${month}-${String(d).padStart(2, '0')}`)
  }
  return days
}

function datesOverlap(day: string, start: string, end: string) {
  const d = new Date(day).getTime()
  return d >= new Date(start.slice(0, 10)).getTime() && d <= new Date(end.slice(0, 10)).getTime()
}

export function LeavePageClient() {
  const [month, setMonth] = useState(monthKey())
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState<string | null>(null)

  const { data: calendarData, mutate: mutateCalendar } = useSWR<LeaveRequestsResponse>(
    `/hr/leave/requests?status=APPROVED&month=${month}&limit=100`,
    swrFetcher,
  )
  const { data: pendingData, mutate: mutatePending } = useSWR<LeaveRequestsResponse>(
    '/hr/leave/requests?status=PENDING&limit=50',
    swrFetcher,
  )

  const calendarDays = useMemo(() => buildCalendarDays(month), [month])
  const approved = calendarData?.items ?? []
  const pending = pendingData?.items ?? []

  const employeesOnLeave = useMemo(() => {
    const map = new Map<string, LeaveRequestItem[]>()
    for (const req of approved) {
      const list = map.get(req.employeeId) ?? []
      list.push(req)
      map.set(req.employeeId, list)
    }
    return map
  }, [approved])

  async function approve(requestId: string) {
    setActing(requestId)
    try {
      await apiClient.post(`/hr/leave/requests/${requestId}/approve`)
      toast.success('Leave approved')
      await mutatePending()
      await mutateCalendar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setActing(null)
    }
  }

  async function reject(requestId: string) {
    if (!rejectReason.trim()) {
      toast.error('Rejection reason is required')
      return
    }
    setActing(requestId)
    try {
      await apiClient.post(`/hr/leave/requests/${requestId}/reject`, { reason: rejectReason })
      toast.success('Leave rejected')
      setRejectId(null)
      setRejectReason('')
      await mutatePending()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rejection failed')
    } finally {
      setActing(null)
    }
  }

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }, [month])

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Leave management"
        subtitle="Team leave calendar and approval queue"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'HR', href: '/hr/employees' },
          { label: 'Leave' },
        ]}
        actions={
          <Link href="/hr/employees">
            <Button variant="secondary" size="sm">Employees</Button>
          </Link>
        }
      />

      <ResponsiveContainer className="flex-1 space-y-6 py-6">
        <Card>
          <CardBody className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="inline-flex items-center gap-2 font-semibold">
                <CalendarDays className="h-5 w-5 text-indigo-600" />
                Leave calendar — {monthLabel}
              </h3>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setMonth(shiftMonth(month, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-36" />
                <Button variant="ghost" size="sm" onClick={() => setMonth(shiftMonth(month, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white p-2 text-left dark:bg-slate-900">Employee</th>
                    {calendarDays.map((day) => (
                      <th key={day} className="p-1 text-center font-normal text-slate-400">
                        {parseInt(day.slice(8), 10)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employeesOnLeave.size === 0 ? (
                    <tr>
                      <td colSpan={calendarDays.length + 1} className="py-8 text-center text-slate-500">
                        No approved leave this month
                      </td>
                    </tr>
                  ) : (
                    Array.from(employeesOnLeave.entries()).map(([empId, requests]) => {
                      const sample = requests[0]
                      return (
                        <tr key={empId} className="border-t border-slate-100">
                          <td className="sticky left-0 bg-white p-2 dark:bg-slate-900">
                            <Link href={`/hr/employees/${empId}`} className="font-medium hover:text-indigo-600">
                              {sample.employeeName}
                            </Link>
                            <p className="text-slate-400">{sample.departmentName ?? sample.employeeNumber}</p>
                          </td>
                          {calendarDays.map((day) => {
                            const onLeave = requests.some((r) => datesOverlap(day, r.startDate, r.endDate))
                            return (
                              <td key={day} className="p-0.5 text-center">
                                {onLeave && (
                                  <span
                                    className="inline-block h-6 w-6 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40"
                                    title={requests.find((r) => datesOverlap(day, r.startDate, r.endDate))?.leaveTypeName}
                                  />
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5">
            <h3 className="mb-4 font-semibold">Pending approvals ({pending.length})</h3>
            {pending.length === 0 ? (
              <p className="text-sm text-slate-500">No pending leave requests.</p>
            ) : (
              <div className="space-y-3">
                {pending.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/hr/employees/${req.employeeId}`} className="font-medium hover:text-indigo-600">
                          {req.employeeName}
                        </Link>
                        <Badge variant="warning" size="sm">Pending</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {req.leaveTypeName} · {req.days} day(s) ·{' '}
                        {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}
                      </p>
                      {req.reason && <p className="mt-1 text-xs text-slate-500">{req.reason}</p>}
                      {rejectId === req.id && (
                        <div className="mt-3 space-y-2">
                          <Textarea
                            placeholder="Rejection reason…"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="danger" loading={acting === req.id} onClick={() => reject(req.id)}>
                              Confirm reject
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setRejectId(null); setRejectReason('') }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    {rejectId !== req.id && (
                      <div className="flex gap-2">
                        <Button size="sm" loading={acting === req.id} onClick={() => approve(req.id)}>
                          <Check className="mr-1 h-4 w-4" /> Approve
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setRejectId(req.id)}>
                          <X className="mr-1 h-4 w-4" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </ResponsiveContainer>
    </div>
  )
}

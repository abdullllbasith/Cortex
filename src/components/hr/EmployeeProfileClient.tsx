'use client'

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, Calendar, DollarSign, Save, User } from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Badge,
  Avatar,
  Input,
  Textarea,
  SelectField,
  toast,
} from '@/components/ui'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'

type Tab = 'profile' | 'attendance' | 'leave' | 'payroll'

interface EmployeeDetail {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string | null
  photo: string | null
  status: string
  type: string
  joinDate: string
  dateOfBirth: string | null
  gender: string | null
  nationalId: string | null
  departmentId: string | null
  designationId: string | null
  managerId: string | null
  departmentName: string | null
  designationTitle: string | null
  emergencyContact: Record<string, unknown> | null
  department?: { id: string; name: string } | null
  designation?: { id: string; title: string } | null
}

interface LeaveBalance {
  leaveTypeId: string
  leaveTypeName: string
  allocatedDays: number
  usedDays: number
  remainingDays: number
}

interface LeaveRequestItem {
  id: string
  leaveTypeName: string
  startDate: string
  endDate: string
  days: number
  status: string
  reason: string | null
  createdAt: string
}

interface AttendanceItem {
  id: string
  date: string
  status: string
  checkIn: string | null
  checkOut: string | null
  workingHours: number
}

interface LeaveTypeOption {
  id: string
  name: string
  code: string
}

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'attendance', label: 'Attendance', icon: Calendar },
  { id: 'leave', label: 'Leave', icon: Calendar },
  { id: 'payroll', label: 'Payroll', icon: DollarSign },
]

interface EmployeeSalaryInfo {
  basicSalary: number
  effectiveFrom: string
  structure: { name: string; isDefault: boolean }
}

interface PayrollSlipItem {
  id: string
  payrollRunId: string
  periodLabel: string
  month: number
  year: number
  grossSalary: number
  totalDeductions: number
  netSalary: number
  status: string
  pdfUrl: string
}

const ATTENDANCE_COLORS: Record<string, string> = {
  PRESENT: 'bg-emerald-500',
  ABSENT: 'bg-red-500',
  HALF_DAY: 'bg-amber-400',
  LATE: 'bg-orange-400',
  HOLIDAY: 'bg-slate-300',
  WEEKEND: 'bg-slate-200',
}

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildCalendarDays(month: string) {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const last = new Date(y, m, 0)
  const days: Date[] = []
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m - 1, d))
  return { days, startPad: first.getDay() }
}

export function EmployeeProfileClient({ employeeId }: { employeeId: string }) {
  const [tab, setTab] = useState<Tab>('profile')
  const [saving, setSaving] = useState(false)
  const [attendanceMonth, setAttendanceMonth] = useState(monthKey())
  const [leaveForm, setLeaveForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' })

  const { data: employee, mutate: mutateEmployee } = useSWR<EmployeeDetail>(
    `/hr/employees/${employeeId}`,
    swrFetcher,
  )

  const [profileForm, setProfileForm] = useState<Partial<EmployeeDetail>>({})

  const emergency = (employee?.emergencyContact ?? {}) as Record<string, string>

  const { data: balances, mutate: mutateBalances } = useSWR<LeaveBalance[]>(
    tab === 'leave' ? `/hr/leave/balance?employeeId=${employeeId}` : null,
    swrFetcher,
  )
  const { data: leaveHistory, mutate: mutateLeave } = useSWR<{ items: LeaveRequestItem[] }>(
    tab === 'leave' ? `/hr/leave/requests?employeeId=${employeeId}&limit=20` : null,
    swrFetcher,
  )
  const { data: leaveTypes } = useSWR<LeaveTypeOption[]>('/hr/leave/types', swrFetcher)
  const { data: attendance } = useSWR<AttendanceItem[]>(
    tab === 'attendance' ? `/hr/attendance?employeeId=${employeeId}&month=${attendanceMonth}` : null,
    swrFetcher,
  )
  const { data: payrollData } = useSWR<{ salary: EmployeeSalaryInfo | null; slips: PayrollSlipItem[] }>(
    tab === 'payroll' || tab === 'profile' ? `/hr/employees/${employeeId}/payroll` : null,
    swrFetcher,
  )

  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceItem>()
    for (const a of attendance ?? []) map.set(a.date, a)
    return map
  }, [attendance])

  const calendar = useMemo(() => buildCalendarDays(attendanceMonth), [attendanceMonth])

  const saveProfile = useCallback(async () => {
    if (!employee) return
    setSaving(true)
    try {
      await apiClient.put(`/hr/employees/${employeeId}`, {
        firstName: profileForm.firstName ?? employee.firstName,
        lastName: profileForm.lastName ?? employee.lastName,
        email: profileForm.email ?? employee.email,
        phone: profileForm.phone ?? employee.phone,
        gender: profileForm.gender ?? employee.gender,
        nationalId: profileForm.nationalId ?? employee.nationalId,
        emergencyContact: {
          name: profileForm.emergencyContact?.name ?? emergency.name,
          phone: profileForm.emergencyContact?.phone ?? emergency.phone,
          relation: profileForm.emergencyContact?.relation ?? emergency.relation,
        },
      })
      toast.success('Profile updated')
      await mutateEmployee()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }, [employee, employeeId, emergency, mutateEmployee, profileForm])

  async function applyLeave() {
    try {
      await apiClient.post('/hr/leave/requests', {
        employeeId,
        leaveTypeId: leaveForm.leaveTypeId,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason || null,
      })
      toast.success('Leave request submitted')
      setLeaveForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' })
      await mutateLeave()
      await mutateBalances()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply leave')
    }
  }

  if (!employee) {
    return (
      <ResponsiveContainer className="py-6">
        <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      </ResponsiveContainer>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={employee.fullName}
        subtitle={`${employee.employeeNumber} · ${employee.designationTitle ?? 'No designation'}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'HR', href: '/hr/employees' },
          { label: 'Employees', href: '/hr/employees' },
          { label: employee.fullName },
        ]}
        actions={
          <Link href="/hr/employees">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
            </Button>
          </Link>
        }
      />

      <ResponsiveContainer className="flex-1 space-y-6 py-6">
        <div className="flex items-center gap-4">
          <Avatar name={employee.fullName} src={employee.photo ?? undefined} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{employee.fullName}</h2>
              <Badge variant={employee.status === 'ACTIVE' ? 'success' : 'warning'} size="sm">
                {employee.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              {employee.departmentName ?? 'Unassigned'} · Joined {new Date(employee.joinDate).toLocaleDateString()}
            </p>
          </div>
        </div>

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

        {tab === 'profile' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardBody className="space-y-4 p-5">
                <h3 className="font-semibold">Personal information</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="First name"
                    defaultValue={employee.firstName}
                    onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                  />
                  <Input
                    label="Last name"
                    defaultValue={employee.lastName}
                    onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                  />
                </div>
                <Input
                  label="Email"
                  defaultValue={employee.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                />
                <Input
                  label="Phone"
                  defaultValue={employee.phone ?? ''}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                />
                <Input
                  label="Gender"
                  defaultValue={employee.gender ?? ''}
                  onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                />
                <Input
                  label="National ID"
                  defaultValue={employee.nationalId ?? ''}
                  onChange={(e) => setProfileForm({ ...profileForm, nationalId: e.target.value })}
                />
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-4 p-5">
                <h3 className="font-semibold">Salary</h3>
                {payrollData?.salary ? (
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Basic salary</dt>
                      <dd className="font-medium tabular-nums">
                        ${payrollData.salary.basicSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Structure</dt>
                      <dd>{payrollData.salary.structure.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Effective from</dt>
                      <dd>{new Date(payrollData.salary.effectiveFrom).toLocaleDateString()}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-slate-500">No salary record — assigned when payroll runs.</p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-4 p-5">
                <h3 className="font-semibold">Job details</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Department</dt>
                    <dd>{employee.departmentName ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Designation</dt>
                    <dd>{employee.designationTitle ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Employment type</dt>
                    <dd>{employee.type.replace('_', ' ')}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Join date</dt>
                    <dd>{new Date(employee.joinDate).toLocaleDateString()}</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            <Card className="lg:col-span-2">
              <CardBody className="space-y-4 p-5">
                <h3 className="font-semibold">Emergency contact</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    label="Name"
                    defaultValue={emergency.name ?? ''}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        emergencyContact: { ...emergency, name: e.target.value },
                      })
                    }
                  />
                  <Input
                    label="Phone"
                    defaultValue={emergency.phone ?? ''}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        emergencyContact: { ...emergency, phone: e.target.value },
                      })
                    }
                  />
                  <Input
                    label="Relationship"
                    defaultValue={emergency.relation ?? ''}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        emergencyContact: { ...emergency, relation: e.target.value },
                      })
                    }
                  />
                </div>
                <Button onClick={saveProfile} loading={saving}>
                  <Save className="mr-1.5 h-4 w-4" /> Save changes
                </Button>
              </CardBody>
            </Card>
          </div>
        )}

        {tab === 'leave' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(balances ?? []).map((b) => (
                <Card key={b.leaveTypeId}>
                  <CardBody className="p-4">
                    <p className="text-sm text-slate-500">{b.leaveTypeName}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{b.remainingDays}</p>
                    <p className="text-xs text-slate-400">
                      {b.usedDays} used of {b.allocatedDays} allocated
                    </p>
                  </CardBody>
                </Card>
              ))}
            </div>

            <Card>
              <CardBody className="space-y-4 p-5">
                <h3 className="font-semibold">Apply for leave</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SelectField
                    label="Leave type"
                    data={(leaveTypes ?? []).map((t) => ({ value: t.id, label: t.name }))}
                    value={leaveForm.leaveTypeId}
                    onValueChange={(v) => setLeaveForm({ ...leaveForm, leaveTypeId: v })}
                  />
                  <Input
                    label="Start date"
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                  />
                  <Input
                    label="End date"
                    type="date"
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                  />
                  <div className="flex items-end">
                    <Button onClick={applyLeave} disabled={!leaveForm.leaveTypeId || !leaveForm.startDate || !leaveForm.endDate}>
                      Submit request
                    </Button>
                  </div>
                </div>
                <Textarea
                  label="Reason"
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  rows={2}
                />
              </CardBody>
            </Card>

            <Card>
              <CardBody className="p-5">
                <h3 className="mb-4 font-semibold">Leave history</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2 pr-4">Dates</th>
                        <th className="pb-2 pr-4">Days</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(leaveHistory?.items ?? []).map((r) => (
                        <tr key={r.id} className="border-b border-slate-100">
                          <td className="py-2 pr-4">{r.leaveTypeName}</td>
                          <td className="py-2 pr-4">
                            {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
                          </td>
                          <td className="py-2 pr-4 tabular-nums">{r.days}</td>
                          <td className="py-2">
                            <Badge
                              variant={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'}
                              size="sm"
                            >
                              {r.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {tab === 'attendance' && (
          <Card>
            <CardBody className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Monthly attendance</h3>
                <Input
                  type="month"
                  value={attendanceMonth}
                  onChange={(e) => setAttendanceMonth(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="py-1 font-medium">{d}</div>
                ))}
                {Array.from({ length: calendar.startPad }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {calendar.days.map((day) => {
                  const key = day.toISOString().slice(0, 10)
                  const record = attendanceMap.get(key)
                  const color = record ? ATTENDANCE_COLORS[record.status] ?? 'bg-slate-200' : 'bg-slate-50'
                  return (
                    <div
                      key={key}
                      title={record ? `${record.status}${record.workingHours ? ` · ${record.workingHours}h` : ''}` : 'No record'}
                      className={`flex aspect-square flex-col items-center justify-center rounded-md ${color} text-slate-800`}
                    >
                      <span className="text-xs font-medium">{day.getDate()}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500" /> Present</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500" /> Absent</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-400" /> Half day</span>
              </div>
            </CardBody>
          </Card>
        )}

        {tab === 'payroll' && (
          <div className="space-y-6">
            <Card>
              <CardBody className="space-y-4 p-5">
                <h3 className="font-semibold">Current compensation</h3>
                {payrollData?.salary ? (
                  <dl className="grid gap-3 sm:grid-cols-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Basic salary</dt>
                      <dd className="text-lg font-semibold tabular-nums">
                        ${payrollData.salary.basicSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Pay structure</dt>
                      <dd className="font-medium">{payrollData.salary.structure.name}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Effective from</dt>
                      <dd>{new Date(payrollData.salary.effectiveFrom).toLocaleDateString()}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-slate-500">Salary will be created on the first payroll run.</p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody className="p-5">
                <h3 className="mb-4 font-semibold">Payslip history</h3>
                {(payrollData?.slips ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">No payslips yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-slate-500">
                          <th className="pb-2 pr-4">Period</th>
                          <th className="pb-2 pr-4">Gross</th>
                          <th className="pb-2 pr-4">Deductions</th>
                          <th className="pb-2 pr-4">Net</th>
                          <th className="pb-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollData!.slips.map((s) => (
                          <tr key={s.id} className="border-b border-slate-100">
                            <td className="py-2 pr-4">{s.periodLabel}</td>
                            <td className="py-2 pr-4 tabular-nums">${s.grossSalary.toFixed(2)}</td>
                            <td className="py-2 pr-4 tabular-nums">${s.totalDeductions.toFixed(2)}</td>
                            <td className="py-2 pr-4 tabular-nums font-medium">${s.netSalary.toFixed(2)}</td>
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <Badge variant={s.status === 'FINAL' ? 'success' : 'warning'} size="sm">
                                  {s.status}
                                </Badge>
                                {s.status === 'FINAL' && (
                                  <a
                                    href={s.pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-indigo-600 hover:underline"
                                  >
                                    PDF
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </ResponsiveContainer>
    </div>
  )
}

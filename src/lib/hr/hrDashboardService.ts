import { prisma } from '@/lib/db/prisma'
import { toNumber } from './hrTypes'
import { estimatePayroll } from './payrollService'

const EMPTY_PAYROLL_ESTIMATE = {
  month: 0,
  year: 0,
  employeeCount: 0,
  estimatedTotalNet: 0,
  warnings: [] as string[],
}

export async function getHrDashboard(tenantId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    totalEmployees,
    onLeaveToday,
    newThisMonth,
    pendingLeaveApprovals,
    departments,
    pendingLeave,
    latestPayroll,
    employeesForAnniversary,
  ] = await Promise.all([
    prisma.employee.count({ where: { tenantId, status: { not: 'TERMINATED' } } }),
    prisma.leaveRequest.count({
      where: {
        tenantId,
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today },
      },
    }),
    prisma.employee.count({
      where: { tenantId, createdAt: { gte: monthStart }, status: { not: 'TERMINATED' } },
    }),
    prisma.leaveRequest.count({ where: { tenantId, status: 'PENDING' } }),
    prisma.department.findMany({
      where: { tenantId },
      select: { id: true, name: true, headcount: true },
      orderBy: { headcount: 'desc' },
    }),
    prisma.leaveRequest.findMany({
      where: { tenantId, status: 'PENDING' },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        leaveType: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.payrollRun
      .findFirst({
        where: { tenantId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      })
      .catch(() => null),
    prisma.employee.findMany({
      where: { tenantId, status: { not: 'TERMINATED' } },
      select: { id: true, firstName: true, lastName: true, joinDate: true },
    }),
  ])

  const upcomingAnniversaries = employeesForAnniversary
    .filter((e) => e.joinDate != null)
    .map((e) => {
      const join = new Date(e.joinDate!)
      const next = new Date(today.getFullYear(), join.getMonth(), join.getDate())
      if (next < today) next.setFullYear(next.getFullYear() + 1)
      const daysUntil = Math.ceil((next.getTime() - today.getTime()) / 86400000)
      return {
        id: e.id,
        name: `${e.firstName} ${e.lastName}`.trim(),
        joinDate: e.joinDate!.toISOString(),
        daysUntil,
        years: next.getFullYear() - join.getFullYear(),
      }
    })
    .filter((a) => a.daysUntil <= 60)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5)

  const attendanceRecords = await prisma.attendance.findMany({
    where: { tenantId, date: { gte: thirtyDaysAgo, lte: today } },
    select: { date: true, status: true },
  })

  const attendanceByDay = new Map<string, { present: number; total: number }>()
  for (const r of attendanceRecords) {
    const key = r.date.toISOString().slice(0, 10)
    const bucket = attendanceByDay.get(key) ?? { present: 0, total: 0 }
    bucket.total += 1
    if (r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'HALF_DAY') {
      bucket.present += r.status === 'HALF_DAY' ? 0.5 : 1
    }
    attendanceByDay.set(key, bucket)
  }

  const attendanceTrend = Array.from(attendanceByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
    }))

  const nextMonth = today.getMonth() + 2
  const nextYear = nextMonth > 12 ? today.getFullYear() + 1 : today.getFullYear()
  const payrollMonth = nextMonth > 12 ? 1 : nextMonth
  const nextPayrollDate = new Date(nextYear, payrollMonth - 1, 25)

  let payrollEstimate = EMPTY_PAYROLL_ESTIMATE
  try {
    payrollEstimate = await estimatePayroll(tenantId, payrollMonth, nextYear)
  } catch {
    payrollEstimate = { ...EMPTY_PAYROLL_ESTIMATE, month: payrollMonth, year: nextYear }
  }

  return {
    kpis: {
      totalEmployees,
      onLeaveToday,
      newThisMonth,
      pendingLeaveApprovals,
      upcomingAnniversaries: upcomingAnniversaries.length,
      nextPayrollDate: nextPayrollDate.toISOString(),
    },
    headcountByDepartment: departments.map((d) => ({
      name: d.name,
      count: d.headcount,
    })),
    attendanceTrend,
    upcomingAnniversaries,
    pendingLeave: pendingLeave.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
      employeeNumber: r.employee.employeeNumber,
      leaveTypeName: r.leaveType.name,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      days: toNumber(r.days),
      reason: r.reason,
    })),
    payrollSummary: {
      lastRun: latestPayroll
        ? {
            id: latestPayroll.id,
            month: latestPayroll.month,
            year: latestPayroll.year,
            status: latestPayroll.status,
            totalNet: toNumber(latestPayroll.totalNet),
          }
        : null,
      nextRunDate: nextPayrollDate.toISOString(),
      estimatedTotalNet: payrollEstimate.estimatedTotalNet,
      eligibleEmployees: payrollEstimate.employeeCount,
    },
  }
}

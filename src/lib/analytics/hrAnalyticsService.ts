import { prisma } from '@/lib/db/prisma'
import type { DateRange } from './periodUtils'

export interface HrAnalyticsResult {
  period: string
  headcount: {
    total: number
    active: number
    onLeave: number
    byDepartment: Array<{ departmentId: string | null; departmentName: string; count: number }>
    trend: Array<{ month: string; count: number }>
  }
  attendance: {
    rate: number
    presentDays: number
    recordsLogged: number
    employeeCount: number
  }
  leave: {
    pendingRequests: number
    approvedThisPeriod: number
    rejectedThisPeriod: number
    utilizationRate: number
  }
  payroll: {
    lastRunMonth: number | null
    lastRunYear: number | null
    lastRunNet: number
    employeeCount: number
  }
}

export async function computeHrAnalytics(tenantId: string, range: DateRange): Promise<HrAnalyticsResult> {
  const [byStatus, byDepartment, departments, attendanceRecords, leaveStats, payrollRun] = await Promise.all([
    prisma.employee.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ['departmentId'],
      where: { tenantId, status: { not: 'TERMINATED' } },
      _count: { _all: true },
    }),
    prisma.department.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    }),
    prisma.attendance.findMany({
      where: { tenantId, date: { gte: range.start, lte: range.end } },
      select: { status: true },
    }),
    Promise.all([
      prisma.leaveRequest.count({ where: { tenantId, status: 'PENDING' } }),
      prisma.leaveRequest.count({
        where: { tenantId, status: 'APPROVED', updatedAt: { gte: range.start, lte: range.end } },
      }),
      prisma.leaveRequest.count({
        where: { tenantId, status: 'REJECTED', updatedAt: { gte: range.start, lte: range.end } },
      }),
      prisma.leaveAllocation.aggregate({
        where: { tenantId },
        _sum: { allocatedDays: true, usedDays: true },
      }),
    ]),
    prisma.payrollRun.findFirst({
      where: { tenantId, status: { not: 'CANCELLED' } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    }),
  ])

  const deptNames = new Map(departments.map((d) => [d.id, d.name]))
  const statusMap: Record<string, number> = {}
  for (const row of byStatus) statusMap[row.status] = row._count._all

  let present = 0
  for (const r of attendanceRecords) {
    if (r.status === 'PRESENT' || r.status === 'LATE') present += 1
    else if (r.status === 'HALF_DAY') present += 0.5
  }
  const attendanceRate =
    attendanceRecords.length > 0 ? Math.round((present / attendanceRecords.length) * 1000) / 10 : 0

  const headcountTrend = await prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
    SELECT to_char(date_trunc('month', "joinDate"), 'YYYY-MM') AS month,
           COUNT(*) AS count
    FROM employees
    WHERE "tenantId" = ${tenantId}
      AND status != 'TERMINATED'
      AND "joinDate" >= NOW() - INTERVAL '12 months'
    GROUP BY 1
    ORDER BY 1
  `

  const [pendingLeave, approvedLeave, rejectedLeave, leaveAgg] = leaveStats
  const allocated = Number(leaveAgg._sum.allocatedDays ?? 0)
  const used = Number(leaveAgg._sum.usedDays ?? 0)
  const utilizationRate = allocated > 0 ? Math.round((used / allocated) * 1000) / 10 : 0

  return {
    period: range.label,
    headcount: {
      total: Object.values(statusMap).reduce((s, n) => s + n, 0),
      active: statusMap.ACTIVE ?? 0,
      onLeave: statusMap.ON_LEAVE ?? 0,
      byDepartment: byDepartment.map((d) => ({
        departmentId: d.departmentId,
        departmentName: d.departmentId ? deptNames.get(d.departmentId) ?? 'Unassigned' : 'Unassigned',
        count: d._count._all,
      })),
      trend: headcountTrend.map((r) => ({ month: r.month, count: Number(r.count) })),
    },
    attendance: {
      rate: attendanceRate,
      presentDays: Math.round(present * 10) / 10,
      recordsLogged: attendanceRecords.length,
      employeeCount: statusMap.ACTIVE ?? 0,
    },
    leave: {
      pendingRequests: pendingLeave,
      approvedThisPeriod: approvedLeave,
      rejectedThisPeriod: rejectedLeave,
      utilizationRate,
    },
    payroll: {
      lastRunMonth: payrollRun?.month ?? null,
      lastRunYear: payrollRun?.year ?? null,
      lastRunNet: payrollRun ? Number(payrollRun.totalNet) : 0,
      employeeCount: payrollRun?.employeeCount ?? 0,
    },
  }
}

import { prisma } from '@/lib/db/prisma'
import { approveLeave, listLeaveRequests } from '@/lib/hr/leaveService'
import { getEmployeeByUserId } from '@/lib/hr/employeeService'
import { parsePeriod } from './tools/tenantData'
import { BaseAgent } from './core/BaseAgent'
import type { AgentTaskInput, AgentToolDefinition } from './core/types'

export class OperationsAgent extends BaseAgent<AgentTaskInput, Record<string, unknown>> {
  private readonly actorId?: string

  readonly systemPrompt = `You are an expert HR Operations AI agent with full workforce data access.
Manage headcount, leave approvals, and attendance using live HR records from the tenant database.`

  readonly tools: AgentToolDefinition[] = [
    { name: 'getHeadcount', description: 'Employee count by status, optional department filter', parameters: { departmentId: 'string' } },
    { name: 'getPendingLeaveRequests', description: 'LeaveRequest WHERE status = PENDING' },
    { name: 'approveLeave', description: 'Approve a pending leave request', parameters: { requestId: 'string' } },
    { name: 'getAttendanceSummary', description: 'Attendance rates by department for period', parameters: { departmentId: 'string', period: 'string' } },
    { name: 'queryKnowledgeBase', description: 'Search HR policies and SOPs' },
  ]

  constructor(tenantId: string, userId?: string, taskId?: string) {
    super(tenantId, 'operations', undefined, userId, taskId)
    this.actorId = userId
  }

  protected async executeTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'getHeadcount':
        return this.getHeadcount(input.departmentId ? String(input.departmentId) : undefined)
      case 'getPendingLeaveRequests':
        return this.getPendingLeaveRequests()
      case 'approveLeave':
        return this.approveLeave(String(input.requestId ?? ''))
      case 'getAttendanceSummary':
        return this.getAttendanceSummary(
          input.departmentId ? String(input.departmentId) : undefined,
          String(input.period ?? 'month'),
        )
      case 'queryKnowledgeBase':
        return this.toolkit.queryKnowledgeBase(String(input.query ?? 'HR policy leave'), 'knowledge')
      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }

  protected heuristicThink(input: AgentTaskInput, iteration: number) {
    const lower = input.task.toLowerCase()
    if (/leave|pto|time off/i.test(lower)) {
      return { reasoning: 'Pending leave queue', plannedTool: 'getPendingLeaveRequests', plannedInput: {}, iteration }
    }
    if (/attendance|present|absent/i.test(lower)) {
      return { reasoning: 'Attendance summary', plannedTool: 'getAttendanceSummary', plannedInput: { period: 'month' }, iteration }
    }
    if (/headcount|employee|workforce/i.test(lower)) {
      return { reasoning: 'Headcount', plannedTool: 'getHeadcount', plannedInput: {}, iteration }
    }
    return { reasoning: 'HR operations overview', plannedTool: 'getHeadcount', plannedInput: {}, iteration }
  }

  async getHeadcount(departmentId?: string) {
    const where = {
      tenantId: this.tenantId,
      ...(departmentId && { departmentId }),
    }

    const [byStatus, byDepartment] = await Promise.all([
      prisma.employee.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      prisma.employee.groupBy({
        by: ['departmentId'],
        where: { ...where, status: { not: 'TERMINATED' } },
        _count: { _all: true },
      }),
    ])

    const departments = await prisma.department.findMany({
      where: { tenantId: this.tenantId },
      select: { id: true, name: true },
    })
    const deptNames = new Map(departments.map((d) => [d.id, d.name]))

    const statusMap: Record<string, number> = {}
    for (const row of byStatus) {
      statusMap[row.status] = row._count._all
    }

    return {
      total: Object.values(statusMap).reduce((s, n) => s + n, 0),
      byStatus: statusMap,
      byDepartment: byDepartment.map((d) => ({
        departmentId: d.departmentId,
        departmentName: d.departmentId ? deptNames.get(d.departmentId) ?? 'Unassigned' : 'Unassigned',
        count: d._count._all,
      })),
    }
  }

  async getPendingLeaveRequests() {
    const result = await listLeaveRequests(this.tenantId, {
      status: 'PENDING',
      limit: 50,
    })

    return {
      count: result.items.length,
      requests: result.items.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        leaveType: r.leaveTypeName,
        startDate: r.startDate,
        endDate: r.endDate,
        days: r.days,
        reason: r.reason,
        status: r.status,
      })),
    }
  }

  async approveLeave(requestId: string) {
    if (!requestId) throw new Error('requestId is required')

    const approverEmployeeId = this.actorId
      ? (await getEmployeeByUserId(this.tenantId, this.actorId))?.id
      : undefined

    if (!approverEmployeeId) {
      throw new Error('Approver must have an employee profile linked to their user account')
    }

    await approveLeave(requestId, this.tenantId, approverEmployeeId)
    return { requestId, status: 'APPROVED', approvedByEmployeeId: approverEmployeeId }
  }

  async getAttendanceSummary(departmentId?: string, period = 'month') {
    const { start, end } = parsePeriod(
      period === '30d' ? 'last 30 days' : period === 'week' ? 'last 7 days' : period,
    )

    let employeeIds: string[] | undefined
    if (departmentId) {
      const emps = await prisma.employee.findMany({
        where: { tenantId: this.tenantId, departmentId, status: { not: 'TERMINATED' } },
        select: { id: true, departmentId: true },
      })
      employeeIds = emps.map((e) => e.id)
    }

    const records = await prisma.attendance.findMany({
      where: {
        tenantId: this.tenantId,
        date: { gte: start, lte: end },
        ...(employeeIds && { employeeId: { in: employeeIds } }),
      },
      select: { status: true, employeeId: true, date: true },
    })

    const byDepartment = new Map<string, { present: number; total: number }>()

    const employeeDeptMap = new Map<string, string | null>()
    if (!departmentId && records.length > 0) {
      const uniqueIds = [...new Set(records.map((r) => r.employeeId))]
      const emps = await prisma.employee.findMany({
        where: { tenantId: this.tenantId, id: { in: uniqueIds } },
        select: { id: true, departmentId: true },
      })
      for (const e of emps) employeeDeptMap.set(e.id, e.departmentId)
    }

    let present = 0
    const total = records.length
    for (const r of records) {
      let weight = 0
      if (r.status === 'PRESENT' || r.status === 'LATE') weight = 1
      else if (r.status === 'HALF_DAY') weight = 0.5
      present += weight

      if (departmentId) continue
      const deptKey = employeeDeptMap.get(r.employeeId) ?? 'unassigned'
      const bucket = byDepartment.get(deptKey) ?? { present: 0, total: 0 }
      bucket.total += 1
      bucket.present += weight
      byDepartment.set(deptKey, bucket)
    }

    const departments = await prisma.department.findMany({
      where: { tenantId: this.tenantId },
      select: { id: true, name: true },
    })
    const deptNames = new Map(departments.map((d) => [d.id, d.name]))

    const employeeCount =
      employeeIds?.length ??
      (await prisma.employee.count({
        where: {
          tenantId: this.tenantId,
          status: { in: ['ACTIVE', 'ON_LEAVE', 'PROBATION'] },
          ...(departmentId && { departmentId }),
        },
      }))

    return {
      period,
      departmentId: departmentId ?? null,
      employeeCount,
      recordsLogged: total,
      presentDays: Math.round(present * 10) / 10,
      attendanceRate: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
      byDepartment: [...byDepartment.entries()].map(([deptId, stats]) => ({
        departmentId: deptId === 'unassigned' ? null : deptId,
        departmentName: deptId === 'unassigned' ? 'Unassigned' : deptNames.get(deptId) ?? deptId,
        attendanceRate:
          stats.total > 0 ? Math.round((stats.present / stats.total) * 1000) / 10 : 0,
        records: stats.total,
      })),
    }
  }
}

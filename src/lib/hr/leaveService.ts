import { LeaveRequestStatus, NotificationSeverity, NotificationType, Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import { notificationService } from '@/lib/notifications/notificationService'
import { countLeaveDays, currentFiscalYear, monthRange, toNumber } from './hrTypes'
import { getEmployee } from './employeeService'

function toDecimal(v: number): Decimal {
  return new Decimal(v)
}

export async function listDepartments(tenantId: string) {
  const items = await prisma.department.findMany({
    where: { tenantId },
    include: {
      manager: { select: { id: true, firstName: true, lastName: true } },
      parent: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  })
  return items.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    headcount: d.headcount,
    managerId: d.managerId,
    parentId: d.parentId,
    managerName: d.manager ? `${d.manager.firstName} ${d.manager.lastName}`.trim() : null,
    parentName: d.parent?.name ?? null,
  }))
}

export async function createDepartment(tenantId: string, data: {
  name: string
  code: string
  managerId?: string | null
  parentId?: string | null
}) {
  return prisma.department.create({
    data: { tenantId, ...data },
  })
}

export async function updateDepartment(tenantId: string, id: string, data: Partial<{
  name: string
  code: string
  managerId: string | null
  parentId: string | null
}>) {
  const existing = await prisma.department.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Department not found')
  return prisma.department.update({ where: { id }, data })
}

export async function deleteDepartment(tenantId: string, id: string) {
  const existing = await prisma.department.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Department not found')
  const assigned = await prisma.employee.count({ where: { tenantId, departmentId: id, status: { not: 'TERMINATED' } } })
  if (assigned > 0) throw new Error('Cannot delete department with active employees')
  await prisma.department.delete({ where: { id } })
  return { id }
}

export async function listDesignations(tenantId: string, departmentId?: string) {
  return prisma.designation.findMany({
    where: { tenantId, ...(departmentId && { departmentId }) },
    include: { department: { select: { id: true, name: true } } },
    orderBy: { title: 'asc' },
  })
}

export async function createDesignation(tenantId: string, data: {
  title: string
  departmentId?: string | null
  level?: string
}) {
  return prisma.designation.create({
    data: {
      tenantId,
      title: data.title,
      departmentId: data.departmentId ?? null,
      level: (data.level as never) ?? 'MID',
    },
  })
}

export async function updateDesignation(tenantId: string, id: string, data: Partial<{
  title: string
  departmentId: string | null
  level: string
}>) {
  const existing = await prisma.designation.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Designation not found')
  return prisma.designation.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.departmentId !== undefined && { departmentId: data.departmentId }),
      ...(data.level !== undefined && { level: data.level as never }),
    },
  })
}

export async function deleteDesignation(tenantId: string, id: string) {
  const existing = await prisma.designation.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Designation not found')
  const assigned = await prisma.employee.count({ where: { tenantId, designationId: id, status: { not: 'TERMINATED' } } })
  if (assigned > 0) throw new Error('Cannot delete designation assigned to employees')
  await prisma.designation.delete({ where: { id } })
  return { id }
}

export async function listLeaveTypes(tenantId: string) {
  return prisma.leaveType.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  })
}

export async function createLeaveType(tenantId: string, data: {
  name: string
  code: string
  daysAllowed: number
  carryForward?: boolean
  maxCarryForward?: number
  isPaid?: boolean
  requiresApproval?: boolean
  isActive?: boolean
}) {
  return prisma.leaveType.create({
    data: {
      tenantId,
      name: data.name,
      code: data.code.toUpperCase(),
      daysAllowed: toDecimal(data.daysAllowed),
      carryForward: data.carryForward ?? false,
      maxCarryForward: toDecimal(data.maxCarryForward ?? 0),
      isPaid: data.isPaid ?? true,
      requiresApproval: data.requiresApproval ?? true,
      isActive: data.isActive ?? true,
    },
  })
}

export async function updateLeaveType(tenantId: string, id: string, data: Partial<{
  name: string
  code: string
  daysAllowed: number
  carryForward: boolean
  maxCarryForward: number
  isPaid: boolean
  requiresApproval: boolean
  isActive: boolean
}>) {
  const existing = await prisma.leaveType.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Leave type not found')
  return prisma.leaveType.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.code !== undefined && { code: data.code.toUpperCase() }),
      ...(data.daysAllowed !== undefined && { daysAllowed: toDecimal(data.daysAllowed) }),
      ...(data.carryForward !== undefined && { carryForward: data.carryForward }),
      ...(data.maxCarryForward !== undefined && { maxCarryForward: toDecimal(data.maxCarryForward) }),
      ...(data.isPaid !== undefined && { isPaid: data.isPaid }),
      ...(data.requiresApproval !== undefined && { requiresApproval: data.requiresApproval }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  })
}

export async function getLeaveBalances(tenantId: string, employeeId: string, fiscalYear = currentFiscalYear()) {
  const allocations = await prisma.leaveAllocation.findMany({
    where: { tenantId, employeeId, fiscalYear },
    include: { leaveType: true },
    orderBy: { leaveType: { name: 'asc' } },
  })

  return allocations.map((a) => ({
    leaveTypeId: a.leaveTypeId,
    leaveTypeName: a.leaveType.name,
    leaveTypeCode: a.leaveType.code,
    fiscalYear: a.fiscalYear,
    allocatedDays: toNumber(a.allocatedDays),
    usedDays: toNumber(a.usedDays),
    remainingDays: toNumber(a.remainingDays),
  }))
}

async function resolveApproverEmployeeId(tenantId: string, employeeId: string): Promise<string | null> {
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: { managerId: true },
  })
  return emp?.managerId ?? null
}

export async function listLeaveRequests(
  tenantId: string,
  filters: {
    status?: LeaveRequestStatus
    employeeId?: string
    month?: string
    page?: number
    limit?: number
  } = {},
) {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 50
  const where: Prisma.LeaveRequestWhereInput = {
    tenantId,
    ...(filters.status && { status: filters.status }),
    ...(filters.employeeId && { employeeId: filters.employeeId }),
  }

  if (filters.month) {
    const { start, end } = monthRange(filters.month)
    where.AND = [{ startDate: { lte: end } }, { endDate: { gte: start } }]
  }

  const [items, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, department: { select: { name: true } } } },
        leaveType: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.leaveRequest.count({ where }),
  ])

  return {
    items: items.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
      employeeNumber: r.employee.employeeNumber,
      departmentName: r.employee.department?.name ?? null,
      leaveTypeId: r.leaveTypeId,
      leaveTypeName: r.leaveType.name,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      days: toNumber(r.days),
      reason: r.reason,
      status: r.status,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      rejectedReason: r.rejectedReason,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  }
}

export async function applyLeave(
  tenantId: string,
  employeeId: string,
  data: { leaveTypeId: string; startDate: string; endDate: string; reason?: string | null },
) {
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, tenantId } })
  if (!emp) throw new Error('Employee not found')
  if (emp.status === 'TERMINATED') throw new Error('Terminated employees cannot apply for leave')

  const startDate = new Date(data.startDate)
  const endDate = new Date(data.endDate)
  const days = countLeaveDays(startDate, endDate)
  if (days <= 0) throw new Error('Leave must include at least one working day')

  const fiscalYear = currentFiscalYear(startDate)
  const allocation = await prisma.leaveAllocation.findFirst({
    where: { tenantId, employeeId, leaveTypeId: data.leaveTypeId, fiscalYear },
    include: { leaveType: true },
  })
  if (!allocation) throw new Error('No leave allocation found for this leave type')
  if (toNumber(allocation.remainingDays) < days) {
    throw new Error(`Insufficient leave balance (${toNumber(allocation.remainingDays)} days remaining)`)
  }

  const request = await prisma.leaveRequest.create({
    data: {
      tenantId,
      employeeId,
      leaveTypeId: data.leaveTypeId,
      startDate,
      endDate,
      days: toDecimal(days),
      reason: data.reason ?? null,
      status: allocation.leaveType.requiresApproval ? 'PENDING' : 'APPROVED',
      ...(allocation.leaveType.requiresApproval ? {} : { approvedAt: new Date() }),
    },
    include: { leaveType: true, employee: true },
  })

  if (!allocation.leaveType.requiresApproval) {
    await deductLeaveAllocation(tenantId, employeeId, data.leaveTypeId, fiscalYear, days)
  } else {
    const approverEmpId = await resolveApproverEmployeeId(tenantId, employeeId)
    const approverUser = approverEmpId
      ? await prisma.employee.findFirst({ where: { id: approverEmpId }, select: { userId: true } })
      : null

    await notificationService.send({
      tenantId,
      userId: approverUser?.userId ?? undefined,
      roleTarget: approverUser?.userId ? undefined : ['MANAGER', 'OWNER', 'CEO'],
      type: NotificationType.ACTIVITY,
      severity: NotificationSeverity.INFO,
      title: 'Leave request pending approval',
      body: `${request.employee.firstName} ${request.employee.lastName} requested ${days} day(s) of ${request.leaveType.name}.`,
      actionUrl: '/hr/leave',
      actionLabel: 'Review leave',
      entityId: `leave-request-${request.id}`,
      metadata: { leaveRequestId: request.id, employeeId },
    })
  }

  return request
}

async function deductLeaveAllocation(
  tenantId: string,
  employeeId: string,
  leaveTypeId: string,
  fiscalYear: number,
  days: number,
) {
  const allocation = await prisma.leaveAllocation.findFirst({
    where: { tenantId, employeeId, leaveTypeId, fiscalYear },
  })
  if (!allocation) return

  const used = toNumber(allocation.usedDays) + days
  const remaining = Math.max(0, toNumber(allocation.allocatedDays) - used)
  await prisma.leaveAllocation.update({
    where: { id: allocation.id },
    data: {
      usedDays: toDecimal(used),
      remainingDays: toDecimal(remaining),
    },
  })
}

export async function approveLeave(requestId: string, tenantId: string, approverEmployeeId: string) {
  const request = await prisma.leaveRequest.findFirst({
    where: { id: requestId, tenantId },
    include: { employee: true, leaveType: true },
  })
  if (!request) throw new Error('Leave request not found')
  if (request.status !== 'PENDING') throw new Error('Leave request is not pending')

  const days = toNumber(request.days)
  const fiscalYear = currentFiscalYear(request.startDate)
  const allocation = await prisma.leaveAllocation.findFirst({
    where: {
      tenantId,
      employeeId: request.employeeId,
      leaveTypeId: request.leaveTypeId,
      fiscalYear,
    },
  })
  if (!allocation || toNumber(allocation.remainingDays) < days) {
    throw new Error('Insufficient leave balance to approve')
  }

  await prisma.leaveRequest.update({
    where: { id: requestId },
    data: {
      status: 'APPROVED',
      approvedBy: approverEmployeeId,
      approvedAt: new Date(),
    },
  })

  await deductLeaveAllocation(tenantId, request.employeeId, request.leaveTypeId, fiscalYear, days)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(request.startDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(request.endDate)
  end.setHours(0, 0, 0, 0)
  if (start <= today && end >= today && request.employee.status === 'ACTIVE') {
    await prisma.employee.update({
      where: { id: request.employeeId },
      data: { status: 'ON_LEAVE' },
    })
  }

  if (request.employee.userId) {
    await notificationService.send({
      tenantId,
      userId: request.employee.userId,
      type: NotificationType.ACTIVITY,
      severity: NotificationSeverity.INFO,
      title: 'Leave request approved',
      body: `Your ${request.leaveType.name} request for ${days} day(s) was approved.`,
      actionUrl: `/hr/employees/${request.employeeId}`,
      actionLabel: 'View profile',
      entityId: `leave-approved-${requestId}`,
    })
  }

  return listLeaveRequests(tenantId, { employeeId: request.employeeId, limit: 20 })
}

export async function rejectLeave(
  requestId: string,
  tenantId: string,
  approverEmployeeId: string,
  reason: string,
) {
  const request = await prisma.leaveRequest.findFirst({
    where: { id: requestId, tenantId },
    include: { employee: true, leaveType: true },
  })
  if (!request) throw new Error('Leave request not found')
  if (request.status !== 'PENDING') throw new Error('Leave request is not pending')

  await prisma.leaveRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      approvedBy: approverEmployeeId,
      approvedAt: new Date(),
      rejectedReason: reason,
    },
  })

  if (request.employee.userId) {
    await notificationService.send({
      tenantId,
      userId: request.employee.userId,
      type: NotificationType.ACTIVITY,
      severity: NotificationSeverity.WARNING,
      title: 'Leave request rejected',
      body: `Your ${request.leaveType.name} request was rejected: ${reason}`,
      actionUrl: `/hr/employees/${request.employeeId}`,
      actionLabel: 'View profile',
      entityId: `leave-rejected-${requestId}`,
    })
  }

  return listLeaveRequests(tenantId, { employeeId: request.employeeId, limit: 20 })
}

export async function getLeaveCalendar(tenantId: string, month?: string) {
  const { start, end } = monthRange(month)
  const requests = await prisma.leaveRequest.findMany({
    where: {
      tenantId,
      status: 'APPROVED',
      startDate: { lte: end },
      endDate: { gte: start },
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
      leaveType: { select: { name: true, code: true } },
    },
  })

  return requests.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
    leaveType: r.leaveType.name,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    days: toNumber(r.days),
  }))
}

export async function listAttendance(
  tenantId: string,
  filters: { employeeId?: string; month?: string; from?: string; to?: string },
) {
  const where: Prisma.AttendanceWhereInput = { tenantId, ...(filters.employeeId && { employeeId: filters.employeeId }) }

  if (filters.month) {
    const { start, end } = monthRange(filters.month)
    where.date = { gte: start, lte: end }
  } else if (filters.from || filters.to) {
    where.date = {}
    if (filters.from) where.date.gte = new Date(filters.from)
    if (filters.to) where.date.lte = new Date(filters.to)
  }

  const items = await prisma.attendance.findMany({
    where,
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [{ date: 'asc' }],
  })

  return items.map((a) => ({
    id: a.id,
    employeeId: a.employeeId,
    employeeName: `${a.employee.firstName} ${a.employee.lastName}`.trim(),
    date: a.date.toISOString().slice(0, 10),
    checkIn: a.checkIn?.toISOString() ?? null,
    checkOut: a.checkOut?.toISOString() ?? null,
    workingHours: toNumber(a.workingHours),
    status: a.status,
    source: a.source,
    notes: a.notes,
  }))
}

export async function recordAttendance(
  tenantId: string,
  data: {
    employeeId: string
    date: string
    checkIn?: string | null
    checkOut?: string | null
    status?: string
    source?: string
    notes?: string | null
  },
) {
  const dateOnly = new Date(data.date)
  dateOnly.setHours(0, 0, 0, 0)

  let workingHours = 0
  const checkIn = data.checkIn ? new Date(data.checkIn) : null
  const checkOut = data.checkOut ? new Date(data.checkOut) : null
  if (checkIn && checkOut) {
    workingHours = Math.round(((checkOut.getTime() - checkIn.getTime()) / 3600000) * 100) / 100
  }

  return prisma.attendance.upsert({
    where: {
      tenantId_employeeId_date: {
        tenantId,
        employeeId: data.employeeId,
        date: dateOnly,
      },
    },
    create: {
      tenantId,
      employeeId: data.employeeId,
      date: dateOnly,
      checkIn,
      checkOut,
      workingHours: toDecimal(workingHours),
      status: (data.status as never) ?? 'PRESENT',
      source: (data.source as never) ?? 'WEB',
      notes: data.notes ?? null,
    },
    update: {
      checkIn,
      checkOut,
      workingHours: toDecimal(workingHours),
      ...(data.status && { status: data.status as never }),
      ...(data.source && { source: data.source as never }),
      notes: data.notes ?? null,
    },
  })
}
import {
  EmployeeStatus,
  EmployeeType,
  NotificationSeverity,
  NotificationType,
  Prisma,
} from '@prisma/client'
import { notificationService } from '@/lib/notifications/notificationService'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import { assertEmailAvailable, EmailAlreadyRegisteredError } from '@/lib/auth/emailAvailability'
import { encryptField, decryptField } from '@/lib/security/encryption'
import { emitSaiosEvent } from '@/lib/workflows/eventBus'
import { currentFiscalYear, toNumber } from './hrTypes'

function toDecimal(v: number): Decimal {
  return new Decimal(v)
}

async function nextEmployeeNumber(tenantId: string): Promise<string> {
  const latest = await prisma.employee.findFirst({
    where: { tenantId, employeeNumber: { startsWith: 'EMP-' } },
    orderBy: { employeeNumber: 'desc' },
    select: { employeeNumber: true },
  })
  const lastSeq = latest ? parseInt(latest.employeeNumber.replace('EMP-', ''), 10) : 0
  return `EMP-${String(lastSeq + 1).padStart(4, '0')}`
}

async function ensureDefaultLeaveTypes(tenantId: string) {
  const count = await prisma.leaveType.count({ where: { tenantId, isActive: true } })
  if (count > 0) return

  await prisma.leaveType.createMany({
    data: [
      { tenantId, name: 'Annual Leave', code: 'ANNUAL', daysAllowed: toDecimal(20), carryForward: true, maxCarryForward: toDecimal(5) },
      { tenantId, name: 'Sick Leave', code: 'SICK', daysAllowed: toDecimal(10), isPaid: true },
      { tenantId, name: 'Unpaid Leave', code: 'UNPAID', daysAllowed: toDecimal(30), isPaid: false },
    ],
  })
}

async function createLeaveAllocationsForEmployee(tenantId: string, employeeId: string, fiscalYear: number) {
  const types = await prisma.leaveType.findMany({ where: { tenantId, isActive: true } })
  for (const lt of types) {
    const allocated = toNumber(lt.daysAllowed)
    await prisma.leaveAllocation.upsert({
      where: {
        tenantId_employeeId_leaveTypeId_fiscalYear: {
          tenantId,
          employeeId,
          leaveTypeId: lt.id,
          fiscalYear,
        },
      },
      create: {
        tenantId,
        employeeId,
        leaveTypeId: lt.id,
        fiscalYear,
        allocatedDays: lt.daysAllowed,
        usedDays: toDecimal(0),
        remainingDays: lt.daysAllowed,
      },
      update: {},
    })
  }
}

async function refreshDepartmentHeadcount(tenantId: string, departmentId?: string | null) {
  if (!departmentId) return
  const headcount = await prisma.employee.count({
    where: { tenantId, departmentId, status: { not: 'TERMINATED' } },
  })
  await prisma.department.update({
    where: { id: departmentId },
    data: { headcount },
  })
}

function mapBankDetails(enc: string | null, tenantId: string) {
  if (!enc) return null
  try {
    return JSON.parse(decryptField(enc, tenantId)) as Record<string, unknown>
  } catch {
    return null
  }
}

function mapEmployeeRow(emp: {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  photo: string | null
  status: EmployeeStatus
  type: EmployeeType
  joinDate: Date
  departmentId: string | null
  designationId: string | null
  department?: { id: string; name: string; code: string } | null
  designation?: { id: string; title: string; level: string } | null
  manager?: { id: string; firstName: string; lastName: string } | null
}) {
  return {
    id: emp.id,
    employeeNumber: emp.employeeNumber,
    firstName: emp.firstName,
    lastName: emp.lastName,
    fullName: `${emp.firstName} ${emp.lastName}`.trim(),
    email: emp.email,
    phone: emp.phone,
    photo: emp.photo,
    status: emp.status,
    type: emp.type,
    joinDate: emp.joinDate.toISOString(),
    departmentId: emp.departmentId,
    designationId: emp.designationId,
    departmentName: emp.department?.name ?? null,
    designationTitle: emp.designation?.title ?? null,
    managerName: emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}`.trim() : null,
  }
}

export async function listEmployees(
  tenantId: string,
  filters: {
    search?: string
    departmentId?: string
    status?: EmployeeStatus
    page?: number
    limit?: number
  } = {},
) {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 24
  const where: Prisma.EmployeeWhereInput = {
    tenantId,
    ...(filters.departmentId && { departmentId: filters.departmentId }),
    ...(filters.status && { status: filters.status }),
    ...(filters.search && {
      OR: [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { employeeNumber: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  }

  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        designation: { select: { id: true, title: true, level: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.employee.count({ where }),
  ])

  return { items: items.map(mapEmployeeRow), total, page, limit }
}

export async function getEmployee(tenantId: string, id: string) {
  const emp = await prisma.employee.findFirst({
    where: { id, tenantId },
    include: {
      department: true,
      designation: true,
      manager: { select: { id: true, firstName: true, lastName: true, email: true } },
      user: { select: { id: true, fullName: true, role: true, isActive: true } },
    },
  })
  if (!emp) throw new Error('Employee not found')

  return {
    ...mapEmployeeRow(emp),
    dateOfBirth: emp.dateOfBirth?.toISOString() ?? null,
    gender: emp.gender,
    nationalId: emp.nationalId,
    address: emp.address,
    emergencyContact: emp.emergencyContact,
    bankDetails: mapBankDetails(emp.bankDetailsEnc, tenantId),
    managerId: emp.managerId,
    userId: emp.userId,
    confirmationDate: emp.confirmationDate?.toISOString() ?? null,
    terminationDate: emp.terminationDate?.toISOString() ?? null,
    terminationReason: emp.terminationReason,
    department: emp.department,
    designation: emp.designation,
    manager: emp.manager,
    user: emp.user,
  }
}

export async function createEmployee(
  tenantId: string,
  data: {
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: string | null
    gender?: string | null
    nationalId?: string | null
    address?: Record<string, unknown>
    photo?: string | null
    departmentId?: string | null
    designationId?: string | null
    managerId?: string | null
    type?: EmployeeType
    status?: EmployeeStatus
    joinDate?: string
    confirmationDate?: string | null
    emergencyContact?: Record<string, unknown>
    bankDetails?: Record<string, unknown> | null
    userId?: string | null
    createUserAccount?: boolean
  },
  actorId?: string,
) {
  const existing = await prisma.employee.findFirst({ where: { tenantId, email: data.email } })
  if (existing) throw new Error('Employee with this email already exists')

  await ensureDefaultLeaveTypes(tenantId)

  let userId = data.userId ?? null
  if (data.createUserAccount && !userId) {
    try {
      await assertEmailAvailable(data.email)
    } catch (err) {
      if (err instanceof EmailAlreadyRegisteredError) {
        throw new Error(err.message)
      }
      throw err
    }

    const user = await prisma.user.create({
      data: {
        tenantId,
        supabaseId: `hr-emp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        email: data.email,
        fullName: `${data.firstName} ${data.lastName}`.trim(),
        phone: data.phone ?? null,
        role: 'EMPLOYEE',
        isActive: true,
      },
    })
    userId = user.id
  }

  let bankDetailsEnc: string | null = null
  if (data.bankDetails && Object.keys(data.bankDetails).length > 0) {
    bankDetailsEnc = encryptField(JSON.stringify(data.bankDetails), tenantId)
  }

  const employee = await prisma.employee.create({
    data: {
      tenantId,
      employeeNumber: await nextEmployeeNumber(tenantId),
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone ?? null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender ?? null,
      nationalId: data.nationalId ?? null,
      address: (data.address ?? {}) as Prisma.InputJsonValue,
      photo: data.photo ?? null,
      departmentId: data.departmentId ?? null,
      designationId: data.designationId ?? null,
      managerId: data.managerId ?? null,
      type: data.type ?? 'FULL_TIME',
      status: data.status ?? 'ACTIVE',
      joinDate: data.joinDate ? new Date(data.joinDate) : new Date(),
      confirmationDate: data.confirmationDate ? new Date(data.confirmationDate) : null,
      emergencyContact: (data.emergencyContact ?? {}) as Prisma.InputJsonValue,
      bankDetailsEnc,
      userId,
    },
  })

  await createLeaveAllocationsForEmployee(tenantId, employee.id, currentFiscalYear())
  await refreshDepartmentHeadcount(tenantId, employee.departmentId)

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actorId,
      action: 'EMPLOYEE_CREATED',
      resourceType: 'employee',
      resourceId: employee.id,
      newValue: { employeeNumber: employee.employeeNumber, email: employee.email },
    },
  })

  const profile = await getEmployee(tenantId, employee.id)

  if (userId) {
    await notificationService.send({
      tenantId,
      userId,
      type: NotificationType.ACTIVITY,
      severity: NotificationSeverity.INFO,
      title: 'Welcome to SAIOS',
      body: `Hi ${employee.firstName}, your employee account (${employee.employeeNumber}) is ready. Explore HR from your dashboard.`,
      actionUrl: '/hr/employees',
      actionLabel: 'View HR',
      entityId: `employee-welcome-${employee.id}`,
      metadata: { employeeId: employee.id },
    }).catch(() => undefined)
  }

  emitSaiosEvent(tenantId, 'new_employee_joined', {
    employeeId: employee.id,
    employeeNumber: employee.employeeNumber,
    email: employee.email,
    firstName: employee.firstName,
    lastName: employee.lastName,
    managerId: employee.managerId,
    departmentId: employee.departmentId,
    userId: profile.userId,
  })

  return profile
}

export async function updateEmployee(
  tenantId: string,
  id: string,
  data: Partial<{
    firstName: string
    lastName: string
    email: string
    phone: string | null
    dateOfBirth: string | null
    gender: string | null
    nationalId: string | null
    address: Record<string, unknown>
    photo: string | null
    departmentId: string | null
    designationId: string | null
    managerId: string | null
    type: EmployeeType
    status: EmployeeStatus
    joinDate: string
    confirmationDate: string | null
    emergencyContact: Record<string, unknown>
    bankDetails: Record<string, unknown> | null
  }>,
  actorId?: string,
) {
  const existing = await prisma.employee.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Employee not found')

  let bankDetailsEnc = existing.bankDetailsEnc
  if (data.bankDetails !== undefined) {
    bankDetailsEnc = data.bankDetails && Object.keys(data.bankDetails).length > 0
      ? encryptField(JSON.stringify(data.bankDetails), tenantId)
      : null
  }

  await prisma.employee.update({
    where: { id },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null }),
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(data.nationalId !== undefined && { nationalId: data.nationalId }),
      ...(data.address !== undefined && { address: data.address as Prisma.InputJsonValue }),
      ...(data.photo !== undefined && { photo: data.photo }),
      ...(data.departmentId !== undefined && { departmentId: data.departmentId }),
      ...(data.designationId !== undefined && { designationId: data.designationId }),
      ...(data.managerId !== undefined && { managerId: data.managerId }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.joinDate !== undefined && { joinDate: new Date(data.joinDate) }),
      ...(data.confirmationDate !== undefined && {
        confirmationDate: data.confirmationDate ? new Date(data.confirmationDate) : null,
      }),
      ...(data.emergencyContact !== undefined && { emergencyContact: data.emergencyContact as Prisma.InputJsonValue }),
      bankDetailsEnc,
    },
  })

  if (data.departmentId !== undefined || existing.departmentId) {
    await refreshDepartmentHeadcount(tenantId, existing.departmentId)
    await refreshDepartmentHeadcount(tenantId, data.departmentId ?? existing.departmentId)
  }

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actorId,
      action: 'EMPLOYEE_UPDATED',
      resourceType: 'employee',
      resourceId: id,
    },
  })

  return getEmployee(tenantId, id)
}

export async function terminateEmployee(
  employeeId: string,
  tenantId: string,
  data: { terminationDate?: string; terminationReason: string },
  actorId?: string,
) {
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, tenantId } })
  if (!emp) throw new Error('Employee not found')
  if (emp.status === 'TERMINATED') throw new Error('Employee already terminated')

  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      status: 'TERMINATED',
      terminationDate: data.terminationDate ? new Date(data.terminationDate) : new Date(),
      terminationReason: data.terminationReason,
    },
  })

  if (emp.userId) {
    await prisma.user.update({
      where: { id: emp.userId },
      data: { isActive: false },
    })
  }

  await refreshDepartmentHeadcount(tenantId, emp.departmentId)

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actorId,
      action: 'EMPLOYEE_TERMINATED',
      resourceType: 'employee',
      resourceId: employeeId,
      newValue: { reason: data.terminationReason },
    },
  })

  return getEmployee(tenantId, employeeId)
}

export async function getEmployeeByUserId(tenantId: string, userId: string) {
  const emp = await prisma.employee.findFirst({ where: { tenantId, userId } })
  if (!emp) return null
  return getEmployee(tenantId, emp.id)
}

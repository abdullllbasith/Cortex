import {
  AgentLogStatus,
  AgentType,
  AttendanceStatus,
  ContactSource,
  ContactType,
  DesignationLevel,
  EmployeeStatus,
  EmployeeType,
  NotificationSeverity,
  NotificationType,
  PayrollRunStatus,
  PrismaClient,
} from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const d = (n: number) => new Decimal(n)

export async function seedHrForTenant(
  prisma: PrismaClient,
  tenantId: string,
  ownerUserId: string,
  tenantSlug: string,
) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existing = await prisma.employee.count({ where: { tenantId } })
  if (existing > 0) {
    const payrollExists = await prisma.payrollRun.count({ where: { tenantId } })
    if (payrollExists > 0) {
      console.log(`  ✓ HR (${tenantSlug}): already seeded`)
      return
    }
    console.log(`  ↻ HR (${tenantSlug}): completing payroll seed…`)
    const lastMonth = today.getMonth() === 0 ? 12 : today.getMonth()
    const lastMonthYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
    const count = await prisma.employee.count({ where: { tenantId, status: { not: 'TERMINATED' } } })
    await prisma.payrollRun.upsert({
      where: { tenantId_month_year: { tenantId, month: lastMonth, year: lastMonthYear } },
      create: {
        tenantId,
        month: lastMonth,
        year: lastMonthYear,
        status: PayrollRunStatus.APPROVED,
        totalGross: d(count * 75000),
        totalDeductions: d(count * 11250),
        totalNet: d(count * 63750),
        employeeCount: count,
        processedBy: ownerUserId,
        approvedBy: ownerUserId,
      },
      update: {},
    })
    return
  }

  await prisma.leaveType.createMany({
    data: [
      { tenantId, name: 'Annual Leave', code: 'ANNUAL', daysAllowed: d(20), carryForward: true, maxCarryForward: d(5) },
      { tenantId, name: 'Sick Leave', code: 'SICK', daysAllowed: d(10) },
      { tenantId, name: 'Unpaid Leave', code: 'UNPAID', daysAllowed: d(30), isPaid: false },
    ],
    skipDuplicates: true,
  })

  const leaveTypes = await prisma.leaveType.findMany({ where: { tenantId, isActive: true } })
  const annualLeave = leaveTypes.find((t) => t.code === 'ANNUAL')!

  const deptEng = await prisma.department.create({
    data: { tenantId, name: 'Engineering', code: 'ENG', headcount: 0 },
  })
  const deptSales = await prisma.department.create({
    data: { tenantId, name: 'Sales', code: 'SALES', headcount: 0 },
  })
  const deptOps = await prisma.department.create({
    data: { tenantId, name: 'Operations', code: 'OPS', headcount: 0 },
  })

  const desigEng = await prisma.designation.create({
    data: { tenantId, title: 'Software Engineer', departmentId: deptEng.id, level: DesignationLevel.MID },
  })
  const desigMgr = await prisma.designation.create({
    data: { tenantId, title: 'Engineering Manager', departmentId: deptEng.id, level: DesignationLevel.SENIOR },
  })
  const desigSales = await prisma.designation.create({
    data: { tenantId, title: 'Account Executive', departmentId: deptSales.id, level: DesignationLevel.MID },
  })

  const salaryStructure = await prisma.salaryStructure.create({
    data: {
      tenantId,
      name: 'Standard Full-Time',
      components: [
        { name: 'Basic Pay', type: 'EARNING', calculationType: 'FIXED', value: 0, isTaxable: true },
        { name: 'Income Tax', type: 'DEDUCTION', calculationType: 'PERCENTAGE_OF_BASIC', value: 10, isTaxable: false },
      ],
      isActive: true,
    },
  })

  const roster: Array<{
    num: string
    firstName: string
    lastName: string
    email: string
    departmentId: string
    designationId: string
    basicSalary: number
    joinMonthsAgo: number
    status?: EmployeeStatus
  }> = [
    { num: '0001', firstName: 'Alex', lastName: 'Rivera', email: `alex.rivera@${tenantSlug}.test`, departmentId: deptEng.id, designationId: desigMgr.id, basicSalary: 95000, joinMonthsAgo: 36 },
    { num: '0002', firstName: 'Jordan', lastName: 'Lee', email: `jordan.lee@${tenantSlug}.test`, departmentId: deptEng.id, designationId: desigEng.id, basicSalary: 78000, joinMonthsAgo: 18 },
    { num: '0003', firstName: 'Sam', lastName: 'Patel', email: `sam.patel@${tenantSlug}.test`, departmentId: deptEng.id, designationId: desigEng.id, basicSalary: 72000, joinMonthsAgo: 8 },
    { num: '0004', firstName: 'Taylor', lastName: 'Nguyen', email: `taylor.nguyen@${tenantSlug}.test`, departmentId: deptSales.id, designationId: desigSales.id, basicSalary: 68000, joinMonthsAgo: 14 },
    { num: '0005', firstName: 'Casey', lastName: 'Morgan', email: `casey.morgan@${tenantSlug}.test`, departmentId: deptSales.id, designationId: desigSales.id, basicSalary: 65000, joinMonthsAgo: 6 },
    { num: '0006', firstName: 'Riley', lastName: 'Brooks', email: `riley.brooks@${tenantSlug}.test`, departmentId: deptOps.id, designationId: desigEng.id, basicSalary: 58000, joinMonthsAgo: 24 },
    { num: '0007', firstName: 'Morgan', lastName: 'Chen', email: `morgan.chen@${tenantSlug}.test`, departmentId: deptOps.id, designationId: desigEng.id, basicSalary: 62000, joinMonthsAgo: 12, status: 'ON_LEAVE' },
  ]

  const fiscalYear = today.getFullYear()
  const employees: string[] = []

  for (const r of roster) {
    const joinDate = new Date(today)
    joinDate.setMonth(joinDate.getMonth() - r.joinMonthsAgo)

    const emp = await prisma.employee.create({
      data: {
        tenantId,
        employeeNumber: `EMP-${r.num}`,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        departmentId: r.departmentId,
        designationId: r.designationId,
        type: EmployeeType.FULL_TIME,
        status: r.status ?? EmployeeStatus.ACTIVE,
        joinDate,
      },
    })
    employees.push(emp.id)

    await prisma.employeeSalary.create({
      data: {
        tenantId,
        employeeId: emp.id,
        salaryStructureId: salaryStructure.id,
        basicSalary: d(r.basicSalary),
        effectiveFrom: joinDate,
        createdBy: ownerUserId,
      },
    })

    for (const lt of leaveTypes) {
      await prisma.leaveAllocation.create({
        data: {
          tenantId,
          employeeId: emp.id,
          leaveTypeId: lt.id,
          fiscalYear,
          allocatedDays: lt.daysAllowed,
          usedDays: d(lt.code === 'ANNUAL' ? 2 : 0),
          remainingDays: d(Math.max(0, Number(lt.daysAllowed) - (lt.code === 'ANNUAL' ? 2 : 0))),
        },
      })
    }
  }

  const managerId = employees[0]!
  await prisma.employee.update({
    where: { id: managerId },
    data: { managerId: null },
  })
  for (let i = 1; i < 3; i++) {
    await prisma.employee.update({
      where: { id: employees[i]! },
      data: { managerId },
    })
  }

  for (const dept of [deptEng, deptSales, deptOps]) {
    const headcount = await prisma.employee.count({
      where: { tenantId, departmentId: dept.id, status: { not: 'TERMINATED' } },
    })
    await prisma.department.update({ where: { id: dept.id }, data: { headcount } })
  }

  for (let day = 0; day < 30; day++) {
    const date = new Date(today)
    date.setDate(date.getDate() - day)
    const dow = date.getDay()
    if (dow === 0 || dow === 6) continue

    for (let i = 0; i < employees.length; i++) {
      const empId = employees[i]!
      const onLeave = i === 6 && day < 3
      await prisma.attendance.create({
        data: {
          tenantId,
          employeeId: empId,
          date,
          status: onLeave ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT,
          workingHours: onLeave ? d(0) : d(8),
          checkIn: onLeave ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0),
          checkOut: onLeave ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 17, 30),
        },
      })
    }
  }

  await prisma.leaveRequest.create({
    data: {
      tenantId,
      employeeId: employees[4]!,
      leaveTypeId: annualLeave.id,
      startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14),
      endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 16),
      days: d(3),
      reason: 'Family event',
      status: 'PENDING',
    },
  })

  const lastMonth = today.getMonth() === 0 ? 12 : today.getMonth()
  const lastMonthYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
  const totalNet = roster.reduce((s, r) => s + r.basicSalary * 0.85, 0)

  await prisma.payrollRun.upsert({
    where: { tenantId_month_year: { tenantId, month: lastMonth, year: lastMonthYear } },
    create: {
      tenantId,
      month: lastMonth,
      year: lastMonthYear,
      status: PayrollRunStatus.APPROVED,
      totalGross: d(roster.reduce((s, r) => s + r.basicSalary, 0)),
      totalDeductions: d(roster.reduce((s, r) => s + r.basicSalary * 0.15, 0)),
      totalNet: d(totalNet),
      employeeCount: roster.length,
      processedBy: ownerUserId,
      approvedBy: ownerUserId,
    },
    update: {},
  })

  console.log(`  ✓ HR (${tenantSlug}): ${roster.length} employees, attendance, leave, payroll`)
}

export async function seedCrmContactsForTenant(prisma: PrismaClient, tenantId: string, ownerUserId: string) {
  const existing = await prisma.crmContact.count({ where: { tenantId } })
  if (existing > 0) return

  const contacts = [
    { firstName: 'Sarah', lastName: 'Chen', company: 'Northwind Traders', email: 'sarah.chen@northwind.com' },
    { firstName: 'Marcus', lastName: 'Johnson', company: 'Contoso Ltd', email: 'marcus@contoso.com' },
    { firstName: 'Elena', lastName: 'Rodriguez', company: 'Fabrikam Inc', email: 'elena@fabrikam.io' },
  ]

  for (const c of contacts) {
    await prisma.crmContact.create({
      data: {
        tenantId,
        type: ContactType.CUSTOMER,
        firstName: c.firstName,
        lastName: c.lastName,
        company: c.company,
        email: c.email,
        source: ContactSource.MANUAL,
        ownerId: ownerUserId,
      },
    })
  }
}

/** Point existing sales_events at CRM contacts for cohort analytics */
export async function backfillSalesEventContacts(prisma: PrismaClient, tenantId: string) {
  const contacts = await prisma.crmContact.findMany({ where: { tenantId }, select: { id: true } })
  if (!contacts.length) return

  const contactIds = contacts.map((c) => c.id)
  const alreadyLinked = await prisma.salesEvent.count({
    where: { tenantId, customerId: { in: contactIds } },
  })
  if (alreadyLinked > 0) return

  const events = await prisma.salesEvent.findMany({
    where: { tenantId },
    select: { id: true },
    orderBy: { timestamp: 'desc' },
    take: 500,
  })

  const BATCH = 50
  for (let i = 0; i < events.length; i += BATCH) {
    const slice = events.slice(i, i + BATCH)
    await prisma.$transaction(
      slice.map((ev, j) =>
        prisma.salesEvent.update({
          where: { id: ev.id },
          data: { customerId: contactIds[(i + j) % contactIds.length]! },
        }),
      ),
    )
  }
}

export async function seedDashboardActivity(
  prisma: PrismaClient,
  tenantId: string,
  ownerUserId: string,
) {
  const logCount = await prisma.agentLog.count({ where: { tenantId } })
  if (logCount > 0) return

  const agents: AgentType[] = ['FINANCE', 'SALES', 'INVENTORY', 'OPERATIONS', 'EXECUTIVE']
  const now = Date.now()

  for (let i = 0; i < agents.length; i++) {
    await prisma.agentLog.create({
      data: {
        tenantId,
        agentId: `seed-${agents[i]!.toLowerCase()}`,
        agentType: agents[i]!,
        action: i === 0 ? 'Reviewed P&L for current month' : i === 1 ? 'Pipeline health check' : i === 2 ? 'Low stock scan completed' : i === 3 ? 'Attendance summary generated' : 'Business health synthesis',
        status: AgentLogStatus.SUCCESS,
        durationMs: 800 + i * 200,
        userId: ownerUserId,
        createdAt: new Date(now - i * 3600000),
      },
    })
  }

  await prisma.notification.createMany({
    data: [
      {
        tenantId,
        userId: ownerUserId,
        type: NotificationType.ALERT,
        title: 'Low stock alert',
        body: 'Industrial Sensor Kit is below reorder point.',
        severity: NotificationSeverity.WARNING,
      },
      {
        tenantId,
        userId: ownerUserId,
        type: NotificationType.REMINDER,
        title: 'Payroll review',
        body: 'Last month payroll run is ready for review.',
        severity: NotificationSeverity.INFO,
      },
    ],
  })
}

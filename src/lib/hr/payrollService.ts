import { JournalReferenceType, Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/db/prisma'
import { resolveAccount, GL_ACCOUNTS } from '@/lib/finance/accountResolver'
import { post } from '@/lib/finance/journalEngine'
import { sendMail } from '@/lib/email/mailTransport'
import { countLeaveDays, countWorkingDaysInMonth, monthRange, roundMoney, toNumber } from './hrTypes'
import type { PayrollLineItem, SalaryComponent } from './payrollTypes'
import { buildPaySlipPdf } from './payrollPdfDocument'

function toDecimal(n: number): Decimal {
  return new Decimal(n)
}

const DEFAULT_COMPONENTS: SalaryComponent[] = [
  { name: 'Basic Pay', type: 'EARNING', calculationType: 'FIXED', value: 0, isTaxable: true },
  { name: 'Housing Allowance', type: 'EARNING', calculationType: 'PERCENTAGE_OF_BASIC', value: 20, isTaxable: true },
  { name: 'Transport Allowance', type: 'BENEFIT', calculationType: 'FIXED', value: 150, isTaxable: false },
  { name: 'Income Tax', type: 'DEDUCTION', calculationType: 'PERCENTAGE_OF_BASIC', value: 10, isTaxable: false },
  { name: 'Pension', type: 'DEDUCTION', calculationType: 'PERCENTAGE_OF_BASIC', value: 5, isTaxable: false },
]

async function ensureDefaultSalaryStructure(tenantId: string) {
  const existing = await prisma.salaryStructure.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
  if (existing) return existing

  return prisma.salaryStructure.create({
    data: {
      tenantId,
      name: 'Standard',
      isDefault: true,
      components: DEFAULT_COMPONENTS.map((c) =>
        c.name === 'Basic Pay' ? { ...c, value: 0 } : c,
      ) as unknown as Prisma.InputJsonValue,
    },
  })
}

export async function getEmployeeSalaryInfo(tenantId: string, employeeId: string) {
  const salary = await prisma.employeeSalary.findFirst({
    where: { tenantId, employeeId },
    orderBy: { effectiveFrom: 'desc' },
    include: { salaryStructure: { select: { id: true, name: true, isDefault: true, components: true } } },
  })
  if (!salary) return null

  return {
    id: salary.id,
    basicSalary: toNumber(salary.basicSalary),
    effectiveFrom: salary.effectiveFrom.toISOString().slice(0, 10),
    structure: {
      id: salary.salaryStructure.id,
      name: salary.salaryStructure.name,
      isDefault: salary.salaryStructure.isDefault,
      components: parseComponents(salary.salaryStructure.components),
    },
  }
}

export async function listEmployeePayrollSlips(tenantId: string, employeeId: string, limit = 12) {
  const slips = await prisma.payrollSlip.findMany({
    where: { tenantId, employeeId },
    include: { payrollRun: { select: { id: true, month: true, year: true, status: true } } },
    orderBy: [{ payrollRun: { year: 'desc' } }, { payrollRun: { month: 'desc' } }],
    take: limit,
  })

  return slips.map((s) => ({
    id: s.id,
    payrollRunId: s.payrollRunId,
    month: s.payrollRun.month,
    year: s.payrollRun.year,
    periodLabel: new Date(s.payrollRun.year, s.payrollRun.month - 1, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    }),
    runStatus: s.payrollRun.status,
    grossSalary: toNumber(s.grossSalary),
    totalDeductions: toNumber(s.totalDeductions),
    netSalary: toNumber(s.netSalary),
    status: s.status,
    pdfUrl: `/api/hr/payroll/${s.payrollRunId}/slips/${employeeId}/pdf`,
  }))
}

async function ensureEmployeeSalary(tenantId: string, employeeId: string, actorId?: string) {
  const latest = await prisma.employeeSalary.findFirst({
    where: { tenantId, employeeId },
    orderBy: { effectiveFrom: 'desc' },
  })
  if (latest) return latest

  const structure = await ensureDefaultSalaryStructure(tenantId)
  return prisma.employeeSalary.create({
    data: {
      tenantId,
      employeeId,
      salaryStructureId: structure.id,
      basicSalary: toDecimal(5000),
      effectiveFrom: new Date(),
      createdBy: actorId ?? null,
    },
    include: { salaryStructure: true },
  })
}

function calcComponentAmount(component: SalaryComponent, basicSalary: number): number {
  if (component.calculationType === 'PERCENTAGE_OF_BASIC') {
    return roundMoney(basicSalary * component.value / 100)
  }
  if (component.name === 'Basic Pay' && component.type === 'EARNING') {
    return roundMoney(basicSalary)
  }
  return roundMoney(component.value)
}

function parseComponents(raw: unknown): SalaryComponent[] {
  if (!Array.isArray(raw)) return []
  return raw as SalaryComponent[]
}

async function getUnpaidLeaveDays(
  tenantId: string,
  employeeId: string,
  month: number,
  year: number,
): Promise<number> {
  const { start, end } = monthRange(`${year}-${String(month).padStart(2, '0')}`)
  const requests = await prisma.leaveRequest.findMany({
    where: {
      tenantId,
      employeeId,
      status: 'APPROVED',
      startDate: { lte: end },
      endDate: { gte: start },
      leaveType: { isPaid: false },
    },
    include: { leaveType: true },
  })

  let days = 0
  for (const req of requests) {
    const overlapStart = req.startDate > start ? req.startDate : start
    const overlapEnd = req.endDate < end ? req.endDate : end
    if (overlapEnd >= overlapStart) {
      days += countLeaveDays(overlapStart, overlapEnd)
    }
  }
  return days
}

async function getPresentDays(tenantId: string, employeeId: string, month: number, year: number): Promise<number> {
  const { start, end } = monthRange(`${year}-${String(month).padStart(2, '0')}`)
  const records = await prisma.attendance.findMany({
    where: {
      tenantId,
      employeeId,
      date: { gte: start, lte: end },
    },
  })

  let present = 0
  for (const r of records) {
    if (r.status === 'PRESENT' || r.status === 'LATE') present += 1
    else if (r.status === 'HALF_DAY') present += 0.5
  }
  return present
}

function mapRun(run: {
  id: string
  month: number
  year: number
  status: string
  totalGross: Decimal
  totalDeductions: Decimal
  totalNet: Decimal
  employeeCount: number
  paidAt: Date | null
  createdAt: Date
}) {
  return {
    id: run.id,
    month: run.month,
    year: run.year,
    periodLabel: new Date(run.year, run.month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    status: run.status,
    totalGross: toNumber(run.totalGross),
    totalDeductions: toNumber(run.totalDeductions),
    totalNet: toNumber(run.totalNet),
    employeeCount: run.employeeCount,
    paidAt: run.paidAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
  }
}

export async function listPayrollRuns(tenantId: string, page = 1, limit = 12) {
  const [items, total] = await Promise.all([
    prisma.payrollRun.findMany({
      where: { tenantId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payrollRun.count({ where: { tenantId } }),
  ])
  return { items: items.map(mapRun), total, page, limit }
}

export async function estimatePayroll(tenantId: string, month: number, year: number) {
  const periodEnd = new Date(year, month, 0)
  const employees = await prisma.employee.findMany({
    where: { tenantId, status: { in: ['ACTIVE', 'ON_LEAVE', 'PROBATION'] } },
    select: { id: true },
  })

  const salaries = employees.length
    ? await prisma.employeeSalary.findMany({
        where: {
          tenantId,
          employeeId: { in: employees.map((e) => e.id) },
          effectiveFrom: { lte: periodEnd },
        },
        orderBy: { effectiveFrom: 'desc' },
        select: { employeeId: true, basicSalary: true },
      })
    : []

  const latestSalaryByEmployee = new Map<string, number>()
  for (const row of salaries) {
    if (!latestSalaryByEmployee.has(row.employeeId)) {
      latestSalaryByEmployee.set(row.employeeId, toNumber(row.basicSalary))
    }
  }

  let estimatedNet = 0
  const warnings: string[] = []
  let missingSalary = 0

  for (const emp of employees) {
    const basic = latestSalaryByEmployee.get(emp.id)
    if (basic == null) {
      missingSalary += 1
      estimatedNet += 5000 * 0.85
      continue
    }
    estimatedNet += basic * 1.15
  }

  if (missingSalary > 0) {
    warnings.push('Some employees lack salary records — defaults will be applied on run.')
  }

  const existing = await prisma.payrollRun.findUnique({
    where: { tenantId_month_year: { tenantId, month, year } },
  })
  if (existing && existing.status !== 'CANCELLED') {
    warnings.push(`Payroll for ${month}/${year} already exists (${existing.status}).`)
  }

  return {
    month,
    year,
    employeeCount: employees.length,
    estimatedTotalNet: roundMoney(estimatedNet),
    warnings: [...new Set(warnings)],
  }
}

export async function runPayroll(tenantId: string, month: number, year: number, actorId?: string) {
  const existing = await prisma.payrollRun.findUnique({
    where: { tenantId_month_year: { tenantId, month, year } },
  })
  if (existing && existing.status !== 'CANCELLED') {
    throw new Error(`Payroll run for ${month}/${year} already exists`)
  }

  const run = await prisma.payrollRun.upsert({
    where: { tenantId_month_year: { tenantId, month, year } },
    create: {
      tenantId,
      month,
      year,
      status: 'PROCESSING',
      processedBy: actorId ?? null,
    },
    update: {
      status: 'PROCESSING',
      processedBy: actorId ?? null,
      totalGross: toDecimal(0),
      totalDeductions: toDecimal(0),
      totalNet: toDecimal(0),
      employeeCount: 0,
    },
  })

  await prisma.payrollSlip.deleteMany({ where: { payrollRunId: run.id } })

  const employees = await prisma.employee.findMany({
    where: { tenantId, status: { in: ['ACTIVE', 'ON_LEAVE', 'PROBATION'] } },
  })

  const workingDays = countWorkingDaysInMonth(month, year)
  let totalGross = 0
  let totalDeductions = 0
  let totalNet = 0
  let slipCount = 0

  for (const emp of employees) {
    const salaryRecord = await ensureEmployeeSalary(tenantId, emp.id, actorId)
    const structure = await prisma.salaryStructure.findFirst({
      where: { id: salaryRecord.salaryStructureId, tenantId },
    })
    if (!structure) continue

    const basicSalary = toNumber(salaryRecord.basicSalary)
    const components = parseComponents(structure.components)

    const earnings: PayrollLineItem[] = []
    const deductions: PayrollLineItem[] = []
    let taxableEarnings = 0

    for (const comp of components) {
      const amount = comp.name === 'Basic Pay' && comp.type === 'EARNING'
        ? roundMoney(basicSalary)
        : calcComponentAmount(comp, basicSalary)

      if (comp.type === 'EARNING' || comp.type === 'BENEFIT') {
        if (amount > 0) earnings.push({ component: comp.name, amount })
        if (comp.isTaxable) taxableEarnings += amount
      } else if (comp.type === 'DEDUCTION') {
        if (amount > 0) deductions.push({ component: comp.name, amount })
      }
    }

    const presentDays = await getPresentDays(tenantId, emp.id, month, year)
    const unpaidLeaveDays = await getUnpaidLeaveDays(tenantId, emp.id, month, year)
    const dailyRate = workingDays > 0 ? basicSalary / workingDays : 0
    const leaveDeductions = roundMoney(unpaidLeaveDays * dailyRate)

    let grossSalary = roundMoney(earnings.reduce((s, e) => s + e.amount, 0) - leaveDeductions)
    if (presentDays > 0 && presentDays < workingDays && workingDays > 0) {
      const attendanceFactor = presentDays / workingDays
      grossSalary = roundMoney(grossSalary * attendanceFactor)
    }

    if (!deductions.some((d) => d.component === 'Income Tax') && taxableEarnings > 0) {
      deductions.push({ component: 'Income Tax', amount: roundMoney(taxableEarnings * 0.1) })
    }

    const slipDeductions = roundMoney(deductions.reduce((s, d) => s + d.amount, 0))
    const taxDeducted = roundMoney(
      deductions.filter((d) => d.component.toLowerCase().includes('tax')).reduce((s, d) => s + d.amount, 0),
    )

    const netSalary = roundMoney(Math.max(0, grossSalary - slipDeductions))

    await prisma.payrollSlip.create({
      data: {
        payrollRunId: run.id,
        tenantId,
        employeeId: emp.id,
        earnings: earnings as unknown as Prisma.InputJsonValue,
        deductions: deductions as unknown as Prisma.InputJsonValue,
        grossSalary: toDecimal(grossSalary),
        totalDeductions: toDecimal(slipDeductions),
        netSalary: toDecimal(netSalary),
        workingDays,
        presentDays: toDecimal(presentDays),
        leaveDeductions: toDecimal(leaveDeductions),
        taxDeducted: toDecimal(taxDeducted),
        status: 'DRAFT',
      },
    })

    totalGross += grossSalary
    totalDeductions += slipDeductions
    totalNet += netSalary
    slipCount += 1
  }

  const updated = await prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: 'REVIEW',
      totalGross: toDecimal(roundMoney(totalGross)),
      totalDeductions: toDecimal(roundMoney(totalDeductions)),
      totalNet: toDecimal(roundMoney(totalNet)),
      employeeCount: slipCount,
    },
  })

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actorId,
      action: 'PAYROLL_RUN_CREATED',
      resourceType: 'payroll_run',
      resourceId: run.id,
      newValue: { month, year, employeeCount: slipCount, totalNet: roundMoney(totalNet) },
    },
  })

  return getPayrollRun(tenantId, updated.id)
}

export async function getPayrollRun(tenantId: string, runId: string) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, tenantId },
    include: {
      slips: {
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              email: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { employee: { lastName: 'asc' } },
      },
    },
  })
  if (!run) throw new Error('Payroll run not found')

  return {
    ...mapRun(run),
    slips: run.slips.map((s: {
      id: string
      employeeId: string
      earnings: unknown
      deductions: unknown
      grossSalary: Decimal
      totalDeductions: Decimal
      netSalary: Decimal
      workingDays: number
      presentDays: Decimal
      leaveDeductions: Decimal
      taxDeducted: Decimal
      status: string
      employee: {
        firstName: string
        lastName: string
        employeeNumber: string
        email: string
        department: { name: string } | null
      }
    }) => ({
      id: s.id,
      employeeId: s.employeeId,
      employeeName: `${s.employee.firstName} ${s.employee.lastName}`.trim(),
      employeeNumber: s.employee.employeeNumber,
      employeeEmail: s.employee.email,
      departmentName: s.employee.department?.name ?? null,
      earnings: s.earnings as PayrollLineItem[],
      deductions: s.deductions as PayrollLineItem[],
      grossSalary: toNumber(s.grossSalary),
      totalDeductions: toNumber(s.totalDeductions),
      netSalary: toNumber(s.netSalary),
      workingDays: s.workingDays,
      presentDays: toNumber(s.presentDays),
      leaveDeductions: toNumber(s.leaveDeductions),
      taxDeducted: toNumber(s.taxDeducted),
      status: s.status,
    })),
  }
}

export async function approvePayroll(runId: string, tenantId: string, approverId: string) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } })
  if (!run) throw new Error('Payroll run not found')
  if (run.status !== 'REVIEW') throw new Error('Payroll run must be in REVIEW status to approve')

  const salaryExpense = await resolveAccount(tenantId, GL_ACCOUNTS.PAYROLL.subtype, [...GL_ACCOUNTS.PAYROLL.codes])
  const salariesPayable = await resolveAccount(
    tenantId,
    GL_ACCOUNTS.SALARIES_PAYABLE.subtype,
    [...GL_ACCOUNTS.SALARIES_PAYABLE.codes],
  )
  const taxPayable = await resolveAccount(tenantId, GL_ACCOUNTS.TAX_PAYABLE.subtype, [...GL_ACCOUNTS.TAX_PAYABLE.codes])

  const gross = toNumber(run.totalGross)
  const net = toNumber(run.totalNet)
  const deductions = toNumber(run.totalDeductions)

  const lines = [
    {
      accountId: salaryExpense.id,
      description: `Payroll ${run.month}/${run.year} — salary expense`,
      debit: gross,
      credit: 0,
    },
    {
      accountId: salariesPayable.id,
      description: `Payroll ${run.month}/${run.year} — net payable`,
      debit: 0,
      credit: net,
    },
  ]

  if (deductions > 0) {
    lines.push({
      accountId: taxPayable.id,
      description: `Payroll ${run.month}/${run.year} — deductions & tax`,
      debit: 0,
      credit: deductions,
    })
  }

  const periodEnd = new Date(run.year, run.month, 0)
  const journal = await post(
    tenantId,
    {
      date: periodEnd,
      description: `Payroll accrual — ${run.month}/${run.year}`,
      reference: `PAY-${run.year}-${String(run.month).padStart(2, '0')}`,
      referenceType: JournalReferenceType.PAYROLL,
      referenceId: run.id,
      lines,
      post: true,
    },
    approverId,
  )

  await prisma.payrollSlip.updateMany({
    where: { payrollRunId: runId },
    data: { status: 'FINAL' },
  })

  const updated = await prisma.payrollRun.update({
    where: { id: runId },
    data: {
      status: 'APPROVED',
      approvedBy: approverId,
      journalEntryId: journal.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: approverId,
      action: 'PAYROLL_APPROVED',
      resourceType: 'payroll_run',
      resourceId: runId,
      newValue: { journalEntryId: journal.id, totalNet: net },
    },
  })

  return getPayrollRun(tenantId, updated.id)
}

export async function generatePaySlipPdf(slipId: string, tenantId: string): Promise<Buffer> {
  const slip = await prisma.payrollSlip.findFirst({
    where: { id: slipId, tenantId },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
          email: true,
          department: { select: { name: true } },
          designation: { select: { title: true } },
        },
      },
      payrollRun: { select: { month: true, year: true } },
    },
  })
  if (!slip) throw new Error('Pay slip not found')

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })

  const doc = buildPaySlipPdf({
    tenantName: tenant?.name ?? 'Company',
    employeeName: `${slip.employee.firstName} ${slip.employee.lastName}`.trim(),
    employeeNumber: slip.employee.employeeNumber,
    department: slip.employee.department?.name ?? null,
    designation: slip.employee.designation?.title ?? null,
    month: slip.payrollRun.month,
    year: slip.payrollRun.year,
    earnings: slip.earnings as unknown as PayrollLineItem[],
    deductions: slip.deductions as unknown as PayrollLineItem[],
    grossSalary: toNumber(slip.grossSalary),
    totalDeductions: toNumber(slip.totalDeductions),
    netSalary: toNumber(slip.netSalary),
    workingDays: slip.workingDays,
    presentDays: toNumber(slip.presentDays),
    leaveDeductions: toNumber(slip.leaveDeductions),
    taxDeducted: toNumber(slip.taxDeducted),
  })

  return renderToBuffer(doc)
}

export async function getPaySlipByRunAndEmployee(tenantId: string, runId: string, employeeId: string) {
  const slip = await prisma.payrollSlip.findFirst({
    where: { payrollRunId: runId, employeeId, tenantId },
  })
  if (!slip) throw new Error('Pay slip not found for employee in this run')
  return slip
}

export async function sendPaySlips(runId: string, tenantId: string, actorId?: string) {
  const run = await getPayrollRun(tenantId, runId)
  if (run.status !== 'APPROVED' && run.status !== 'PAID') {
    throw new Error('Payroll must be approved before sending payslips')
  }

  let sent = 0
  const errors: string[] = []

  for (const slip of run.slips) {
    if (!slip.employeeEmail) {
      errors.push(`${slip.employeeName}: no email on file`)
      continue
    }
    try {
      const pdf = await generatePaySlipPdf(slip.id, tenantId)
      await sendMail({
        to: slip.employeeEmail,
        subject: `Payslip — ${run.periodLabel}`,
        text: `Dear ${slip.employeeName},\n\nPlease find your payslip for ${run.periodLabel} attached.\n\nNet pay: $${slip.netSalary.toFixed(2)}`,
        fromName: process.env.SMTP_FROM_NAME ?? 'Cortex HR',
        attachments: [
          {
            filename: `payslip-${slip.employeeNumber}-${run.year}-${run.month}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          },
        ],
      })
      sent += 1
    } catch (err) {
      errors.push(`${slip.employeeName}: ${err instanceof Error ? err.message : 'send failed'}`)
    }
  }

  if (sent > 0) {
    await prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'PAID', paidAt: new Date() },
    })
  }

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actorId,
      action: 'PAYSLIPS_SENT',
      resourceType: 'payroll_run',
      resourceId: runId,
      newValue: { sent, errors: errors.length },
    },
  })

  return { sent, failed: errors.length, errors }
}

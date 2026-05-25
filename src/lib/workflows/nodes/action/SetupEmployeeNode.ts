import { Decimal } from '@prisma/client/runtime/library'
import { UserRole } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { currentFiscalYear } from '@/lib/hr/hrTypes'
import { WorkflowContext, getByPath } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { nodeError, validateConfig } from '../utils'

const schema = z.object({
  employeeIdField: z.string().default('employeeId'),
  emailField: z.string().default('employee.email'),
  createUserIfMissing: z.boolean().default(true),
  role: z.string().default('EMPLOYEE'),
  createLeaveAllocations: z.boolean().default(true),
})

async function ensureLeaveAllocations(tenantId: string, employeeId: string) {
  const types = await prisma.leaveType.findMany({ where: { tenantId, isActive: true } })
  const fiscalYear = currentFiscalYear()
  for (const lt of types) {
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
        usedDays: new Decimal(0),
        remainingDays: lt.daysAllowed,
      },
      update: {},
    })
  }
}

export const setupEmployeeHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.setup_employee')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const vars = { ...ctx.variables, ...inputData }

  const employeeId = String(getByPath(vars, cfg.employeeIdField) ?? '').trim()
  if (!employeeId) throw nodeError('action.setup_employee', 'employeeId is required')

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId: engineCtx.tenantId },
  })
  if (!employee) throw nodeError('action.setup_employee', `Employee ${employeeId} not found`)

  let userId = employee.userId
  let temporaryPassword: string | null = null

  if (cfg.createUserIfMissing && !userId) {
    temporaryPassword = `Welcome-${Math.random().toString(36).slice(2, 10)}!`
    const user = await prisma.user.create({
      data: {
        tenantId: engineCtx.tenantId,
        supabaseId: `hr-emp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        email: employee.email,
        fullName: `${employee.firstName} ${employee.lastName}`.trim(),
        phone: employee.phone,
        role: cfg.role as UserRole,
        isActive: true,
      },
    })
    userId = user.id
    await prisma.employee.update({ where: { id: employee.id }, data: { userId } })
    ctx.appendLog(`User account created for ${employee.email}`)
  }

  if (cfg.createLeaveAllocations) {
    await ensureLeaveAllocations(engineCtx.tenantId, employee.id)
    ctx.appendLog(`Leave allocations ensured for ${employee.employeeNumber}`)
  }

  return {
    outputData: {
      ...inputData,
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        userId,
      },
      loginEmail: employee.email,
      temporaryPassword,
      leaveAllocationsCreated: cfg.createLeaveAllocations,
    },
  }
}

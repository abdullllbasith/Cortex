import { z } from 'zod'
import { runPayroll } from '@/lib/hr/payrollService'
import { WorkflowContext } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { validateConfig } from '../utils'

const schema = z.object({
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  onlyIfPayrollDate: z.boolean().default(true),
  payrollDayOfMonth: z.number().int().min(1).max(28).default(25),
})

export const runPayrollHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.run_payroll')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const now = new Date()
  const month = cfg.month ?? now.getMonth() + 1
  const year = cfg.year ?? now.getFullYear()
  const actorId = engineCtx.triggeredBy !== 'system' ? engineCtx.triggeredBy : undefined

  if (cfg.onlyIfPayrollDate && now.getDate() !== cfg.payrollDayOfMonth) {
    ctx.appendLog(`Skipped payroll run — today is day ${now.getDate()}, payroll day is ${cfg.payrollDayOfMonth}`)
    return {
      outputData: { ...inputData, payrollRun: null, payrollSkipped: true, reason: 'not_payroll_date' },
      branch: 'false',
    }
  }

  try {
    const payrollRun = await runPayroll(engineCtx.tenantId, month, year, actorId)
    ctx.appendLog(`Payroll run created for ${month}/${year}: ${payrollRun.id}`)
    return {
      outputData: {
        ...inputData,
        payrollRun,
        payrollRunId: payrollRun.id,
        payrollMonth: month,
        payrollYear: year,
        payrollSkipped: false,
      },
      branch: 'true',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payroll run failed'
    if (/already exists/i.test(message)) {
      ctx.appendLog(`Payroll run already exists for ${month}/${year}`)
      return {
        outputData: { ...inputData, payrollRun: null, payrollSkipped: true, reason: 'already_exists' },
        branch: 'false',
      }
    }
    throw err
  }
}

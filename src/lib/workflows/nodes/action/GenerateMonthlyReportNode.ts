import { z } from 'zod'
import { checkOverdue as checkOverdueInvoices, getArAgingReport } from '@/lib/finance/invoiceService'
import { getApAgingReport } from '@/lib/finance/billService'
import { getProfitAndLoss } from '@/lib/finance/reportingService'
import { generateReorderSuggestions } from '@/lib/inventory/reorderService'
import { WorkflowContext } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { validateConfig } from '../utils'

const schema = z.object({
  includePnL: z.boolean().default(true),
  includeArAging: z.boolean().default(true),
  includeApAging: z.boolean().default(true),
  includeReorderSuggestions: z.boolean().default(false),
  sendOverdueReminders: z.boolean().default(false),
})

export const generateMonthlyReportHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.generate_monthly_report')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
  const endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)

  const report: Record<string, unknown> = { period: { startDate, endDate } }

  if (cfg.includePnL) {
    report.profitAndLoss = await getProfitAndLoss(engineCtx.tenantId, startDate, endDate)
  }
  if (cfg.includeArAging) {
    report.arAging = await getArAgingReport(engineCtx.tenantId)
  }
  if (cfg.includeApAging) {
    report.apAging = await getApAgingReport(engineCtx.tenantId)
  }
  if (cfg.includeReorderSuggestions) {
    report.reorderSuggestions = await generateReorderSuggestions(engineCtx.tenantId, 'all')
  }
  if (cfg.sendOverdueReminders) {
    report.overdueCheck = await checkOverdueInvoices(engineCtx.tenantId)
  }

  ctx.appendLog(`Monthly report generated for ${startDate} → ${endDate}`)
  return { outputData: { ...inputData, monthlyReport: report, reportPeriod: { startDate, endDate } } }
}

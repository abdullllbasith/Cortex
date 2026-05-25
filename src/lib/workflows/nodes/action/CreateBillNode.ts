import { z } from 'zod'
import { createFromPO } from '@/lib/finance/billService'
import { WorkflowContext, getByPath } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { nodeError, validateConfig } from '../utils'

const schema = z.object({
  poIdField: z.string().default('poId'),
})

export const createBillHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.create_bill')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const vars = { ...ctx.variables, ...inputData }
  const poId = String(getByPath(vars, cfg.poIdField) ?? '').trim()
  if (!poId) throw nodeError('action.create_bill', 'poId is required')

  const actorId = engineCtx.triggeredBy !== 'system' ? engineCtx.triggeredBy : undefined
  const bill = await createFromPO(poId, engineCtx.tenantId, actorId)
  ctx.appendLog(`Bill ${bill.billNumber} created from PO ${poId}`)

  return {
    outputData: {
      ...inputData,
      bill,
      billId: bill.id,
      billNumber: bill.billNumber,
      billAmount: bill.amountDue,
    },
  }
}

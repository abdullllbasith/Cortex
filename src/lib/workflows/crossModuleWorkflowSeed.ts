import { WorkflowTriggerType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { triggerManager } from '@/lib/workflows/TriggerManager'
import type { WorkflowDefinitionJSON } from '@/lib/workflows/types'
import orderToCash from '@/lib/workflows/templates/orderToCashWorkflow.json'
import procureToPay from '@/lib/workflows/templates/procureToPayWorkflow.json'
import procureToPayReceipt from '@/lib/workflows/templates/procureToPayReceiptWorkflow.json'
import leadToDeal from '@/lib/workflows/templates/leadToDealWorkflow.json'
import monthEnd from '@/lib/workflows/templates/monthEndWorkflow.json'

/** Core cross-module automation workflows (Stage 3). */
export const CROSS_MODULE_WORKFLOW_DEFS: Array<{
  name: string
  description: string
  definition: WorkflowDefinitionJSON
}> = [
  {
    name: 'Order to Cash',
    description: 'ORDER_DELIVERED → inventory SALE → invoice → reminders → escalation',
    definition: orderToCash as WorkflowDefinitionJSON,
  },
  {
    name: 'Procure to Pay',
    description: 'STOCK_BELOW_REORDER → AI decision → auto PO or manager alert',
    definition: procureToPay as WorkflowDefinitionJSON,
  },
  {
    name: 'Procure to Pay — Goods Received',
    description: 'GOODS_RECEIVED → bill → payment reminder → record payment',
    definition: procureToPayReceipt as WorkflowDefinitionJSON,
  },
  {
    name: 'Lead to Deal',
    description: 'NEW_CONTACT_CREATED (LEAD) → nurture → activity checks → offer → re-engagement',
    definition: leadToDeal as WorkflowDefinitionJSON,
  },
  {
    name: 'Month-End Close',
    description: 'Scheduled 0 8 1 * * — P&L, AR, reminders, reorder report, executive digest',
    definition: monthEnd as WorkflowDefinitionJSON,
  },
]

/**
 * Seed and register the four core automation workflows (+ goods-received companion).
 * Call on tenant bootstrap and from TriggerManager.initialize after DB workflows load.
 */
export async function seedCrossModuleWorkflowsForTenant(
  tenantId: string,
  createdBy?: string,
): Promise<string[]> {
  const ids: string[] = []

  for (const { name, description, definition } of CROSS_MODULE_WORKFLOW_DEFS) {
    const existing = await prisma.workflowDefinition.findFirst({
      where: { tenantId, name },
    })

    if (existing) {
      await prisma.workflowDefinition.update({
        where: { id: existing.id },
        data: {
          description,
          triggerType: definition.triggerType as WorkflowTriggerType,
          triggerConfig: definition.triggerConfig as object,
          nodes: definition.nodes as object[],
          edges: definition.edges as object[],
          isActive: true,
        },
      })
      await triggerManager.registerWorkflow(existing.id)
      ids.push(existing.id)
      continue
    }

    const wf = await prisma.workflowDefinition.create({
      data: {
        tenantId,
        name,
        description,
        triggerType: definition.triggerType as WorkflowTriggerType,
        triggerConfig: definition.triggerConfig as object,
        nodes: definition.nodes as object[],
        edges: definition.edges as object[],
        isActive: true,
        createdBy: createdBy ?? null,
      },
    })
    await triggerManager.registerWorkflow(wf.id)
    ids.push(wf.id)
  }

  return ids
}

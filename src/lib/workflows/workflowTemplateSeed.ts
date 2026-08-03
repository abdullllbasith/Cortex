import { WorkflowTriggerType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { triggerManager } from '@/lib/workflows/TriggerManager'
import { listTemplates } from '@/lib/workflows/templates/index'

/**
 * Seed every canonical workflow template for a tenant (active + registered triggers).
 * Idempotent: updates existing workflows by name and registers triggers.
 */
export async function seedAllWorkflowTemplatesForTenant(
  tenantId: string,
  createdBy?: string,
): Promise<string[]> {
  const ids: string[] = []

  for (const template of listTemplates()) {
    const { definition, name, description } = template
    const triggerType = definition.triggerType as WorkflowTriggerType

    const existing = await prisma.workflowDefinition.findFirst({
      where: { tenantId, name },
    })

    if (existing) {
      await prisma.workflowDefinition.update({
        where: { id: existing.id },
        data: {
          description,
          triggerType,
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
        triggerType,
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

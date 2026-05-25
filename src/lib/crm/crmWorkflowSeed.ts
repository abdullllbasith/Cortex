import { WorkflowTriggerType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { getTemplateById } from '@/lib/workflows/templates/index'
import { triggerManager } from '@/lib/workflows/TriggerManager'
import type { WorkflowDefinitionJSON } from '@/lib/workflows/types'

const CRM_EVENT_TEMPLATES: Array<{ templateId: string; name: string }> = [
  { templateId: 'crm-lead-nurture', name: 'CRM Lead Nurture' },
  { templateId: 'crm-deal-won-onboarding', name: 'CRM Deal Won Onboarding' },
  { templateId: 'crm-deal-lost-reengagement', name: 'CRM Deal Lost Re-engagement' },
  { templateId: 'crm-follow-up-due', name: 'CRM Follow-up Reminder' },
]

/** Seed and activate default CRM event workflows (TriggerManager registration). */
export async function seedCrmEventWorkflowsForTenant(tenantId: string, createdBy?: string): Promise<void> {
  for (const { templateId, name } of CRM_EVENT_TEMPLATES) {
    const definition = getTemplateById(templateId) as WorkflowDefinitionJSON | undefined
    if (!definition) continue

    const existing = await prisma.workflowDefinition.findFirst({
      where: { tenantId, name },
    })
    if (existing) {
      if (!existing.isActive) await triggerManager.activateWorkflow(existing.id)
      continue
    }

    const wf = await prisma.workflowDefinition.create({
      data: {
        tenantId,
        name,
        description: `Auto-seeded from template ${templateId}`,
        triggerType: WorkflowTriggerType.EVENT,
        triggerConfig: definition.triggerConfig as object,
        nodes: definition.nodes as object[],
        edges: definition.edges as object[],
        isActive: true,
        createdBy: createdBy ?? null,
      },
    })
    await triggerManager.registerWorkflow(wf.id)
  }
}

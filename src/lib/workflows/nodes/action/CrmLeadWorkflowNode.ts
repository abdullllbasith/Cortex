import { ActivityType, NotificationSeverity, NotificationType } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { createActivity } from '@/lib/crm/activityService'
import { scheduleFollowUp } from '@/lib/crm/contactService'
import { notificationService } from '@/lib/notifications/notificationService'
import { emitSaiosEvent } from '@/lib/workflows/eventBus'
import { WorkflowContext, getByPath } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { nodeError, validateConfig } from '../utils'

const schema = z.object({
  step: z.enum([
    'filter_lead',
    'create_task',
    'check_activity',
    'check_deal',
    'escalate_no_activity',
    'send_offer',
    'trigger_onboarding',
    'reengagement',
  ]),
  contactIdField: z.string().default('contactId'),
  ownerIdField: z.string().default('ownerId'),
  companyNameField: z.string().default('tenantName'),
})

export const crmLeadWorkflowHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.crm_lead_workflow')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const vars = { ...ctx.variables, ...inputData }
  const contactId = String(getByPath(vars, cfg.contactIdField) ?? '').trim()
  if (!contactId) throw nodeError('action.crm_lead_workflow', 'contactId is required')

  const contact = await prisma.crmContact.findFirst({
    where: { id: contactId, tenantId: engineCtx.tenantId },
    select: {
      id: true,
      type: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      ownerId: true,
      company: true,
    },
  })
  if (!contact) throw nodeError('action.crm_lead_workflow', 'Contact not found')

  const name = `${contact.firstName} ${contact.lastName}`.trim()
  const ownerId = String(getByPath(vars, cfg.ownerIdField) ?? contact.ownerId ?? '').trim() || null
  const companyName = String(getByPath(vars, cfg.companyNameField) ?? 'our team')

  switch (cfg.step) {
    case 'filter_lead': {
      const isLead = contact.type === 'LEAD'
      ctx.appendLog(isLead ? `Contact ${name} is a LEAD — continuing nurture` : `Skipping — contact type is ${contact.type}`)
      return {
        outputData: { ...inputData, contactId, contactName: name, ownerId, isLead },
        branch: isLead ? 'true' : 'false',
      }
    }

    case 'create_task': {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const activity = await createActivity(
        engineCtx.tenantId,
        {
          type: ActivityType.TASK,
          contactId,
          subject: `Follow up with ${name}`,
          description: 'Auto-created by Lead-to-Deal workflow',
          scheduledAt: tomorrow.toISOString(),
          assignedTo: ownerId,
          isCompleted: false,
        },
        ownerId ?? undefined,
      )
      ctx.appendLog(`Created follow-up task for ${name}`)
      return { outputData: { ...inputData, contactId, activityId: activity.id, taskDue: tomorrow.toISOString() } }
    }

    case 'check_activity': {
      const since = new Date()
      since.setDate(since.getDate() - 3)
      const count = await prisma.crmActivity.count({
        where: {
          tenantId: engineCtx.tenantId,
          contactId,
          createdAt: { gte: since },
        },
      })
      const hasActivity = count > 0
      ctx.appendLog(`${name}: ${count} activities in last 3 days`)
      return {
        outputData: { ...inputData, contactId, contactName: name, hasActivity, activityCount: count },
        branch: hasActivity ? 'true' : 'false',
      }
    }

    case 'check_deal': {
      const openDeal = await prisma.crmDeal.findFirst({
        where: { tenantId: engineCtx.tenantId, contactId, status: 'OPEN' },
        select: { id: true, title: true },
      })
      const hasOpenDeal = Boolean(openDeal)
      ctx.appendLog(hasOpenDeal ? `Open deal: ${openDeal!.title}` : `No open deal for ${name}`)
      return {
        outputData: { ...inputData, contactId, hasOpenDeal, dealId: openDeal?.id ?? null },
        branch: hasOpenDeal ? 'true' : 'false',
      }
    }

    case 'escalate_no_activity': {
      if (ownerId) {
        await notificationService.send({
          tenantId: engineCtx.tenantId,
          userId: ownerId,
          type: NotificationType.REMINDER,
          severity: NotificationSeverity.WARNING,
          title: 'Lead needs attention',
          body: `Lead ${name} has no logged activity after 3 days`,
          actionUrl: `/crm/contacts/${contactId}`,
          actionLabel: 'View contact',
        })
      }
      ctx.appendLog(`Escalated inactive lead ${name}`)
      return { outputData: { ...inputData, escalated: true, contactName: name } }
    }

    case 'send_offer': {
      const message = `Hi ${contact.firstName}, we'd love to share our latest offers with you. Reply to connect with ${companyName}.`
      return {
        outputData: {
          ...inputData,
          contactId,
          offerMessage: message,
          contactEmail: contact.email,
          contactPhone: contact.phone,
        },
      }
    }

    case 'trigger_onboarding': {
      const wonDeal = await prisma.crmDeal.findFirst({
        where: { tenantId: engineCtx.tenantId, contactId, status: 'WON' },
        orderBy: { updatedAt: 'desc' },
      })
      if (wonDeal) {
        emitSaiosEvent(engineCtx.tenantId, 'deal_won', {
          dealId: wonDeal.id,
          contactId,
          title: wonDeal.title,
          value: wonDeal.value,
          ownerId: wonDeal.ownerId,
        })
      }
      ctx.appendLog('Triggered onboarding via deal_won event')
      return { outputData: { ...inputData, onboardingTriggered: true } }
    }

    case 'reengagement': {
      const followUp = new Date()
      followUp.setDate(followUp.getDate() + 7)
      await scheduleFollowUp(engineCtx.tenantId, contactId, followUp, ownerId ?? undefined)
      ctx.appendLog(`Scheduled re-engagement for ${name}`)
      return { outputData: { ...inputData, reengagementScheduled: true } }
    }

    default:
      return { outputData: inputData }
  }
}

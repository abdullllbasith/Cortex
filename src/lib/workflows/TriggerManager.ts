import { createHash, randomBytes } from 'crypto'
import cron from 'node-cron'
import { WorkflowTriggerType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { workflowEngine } from './core/WorkflowEngine'
import { saiosEventBus, type SaiosEventPayload, type SaiosEventType } from './eventBus'
import { seedCrossModuleWorkflowsForTenant } from './crossModuleWorkflowSeed'
import '@/lib/workflows/nodes'

type CronTask = ReturnType<typeof cron.schedule>
type EventHandler = (payload: SaiosEventPayload) => void

interface RegisteredWorkflow {
  cronTasks: CronTask[]
  eventHandlers: Array<{ type: SaiosEventType; handler: EventHandler }>
}

const registry = new Map<string, RegisteredWorkflow>()
let initialized = false

/** Canonical event names (emitter) ↔ workflow trigger config */
export const WORKFLOW_EVENT_REGISTRY = {
  ORDER_DELIVERED: 'order_delivered' as const,
  STOCK_BELOW_REORDER: 'stock_below_reorder' as const,
  NEW_CONTACT_CREATED: 'new_contact_created' as const,
  GOODS_RECEIVED: 'goods_received' as const,
  DEAL_WON: 'deal_won' as const,
  DEAL_LOST: 'deal_lost' as const,
  FOLLOW_UP_DUE: 'follow_up_due' as const,
} satisfies Record<string, SaiosEventType>

/** Month-end close schedule: 1st of every month at 08:00 (UTC in template; override per-tenant in triggerConfig). */
export const MONTH_END_CRON = '0 8 1 * *'

function generateWebhookToken(): string {
  return createHash('sha256').update(randomBytes(32)).digest('hex').slice(0, 32)
}

/**
 * Module 06 — workflow triggers (Stage 3 cross-module automation).
 *
 * Registered SaiosEventType values (eventBus):
 * - order_delivered (ORDER_DELIVERED) — sales order fulfilled; order-to-cash workflow
 * - stock_below_reorder (STOCK_BELOW_REORDER) — inventoryWebhooks; procure-to-pay workflow
 * - new_contact_created (NEW_CONTACT_CREATED) — contactService; lead-to-deal workflow
 * - goods_received (GOODS_RECEIVED) — purchaseOrderService.receiveGoods; P2P receipt leg
 * - deal_won / deal_lost / follow_up_due — CRM pipeline & scheduler
 *
 * Scheduled:
 * - Month-End Close — cron `0 8 1 * *` (1st of month, 08:00)
 */
export class TriggerManager {
  /**
   * Load active workflows from DB, seed core templates per tenant if missing, register listeners.
   */
  async initialize(): Promise<void> {
    if (initialized) return
    initialized = true

    const tenants = await prisma.tenant.findMany({ select: { id: true }, take: 50 })
    for (const t of tenants) {
      try {
        await seedCrossModuleWorkflowsForTenant(t.id)
      } catch (err) {
        console.warn(`[TriggerManager] Cross-module seed skipped for ${t.id}:`, err)
      }
    }

    const active = await prisma.workflowDefinition.findMany({
      where: { isActive: true },
    })

    for (const wf of active) {
      await this.registerWorkflow(wf.id)
    }

    console.info(
      `[TriggerManager] Initialized — ${active.length} active workflow(s); events: ${Object.values(WORKFLOW_EVENT_REGISTRY).join(', ')}; month-end cron: ${MONTH_END_CRON}`,
    )
  }

  async registerWorkflow(workflowId: string): Promise<void> {
    await this.deregisterAll(workflowId)

    const wf = await prisma.workflowDefinition.findUnique({ where: { id: workflowId } })
    if (!wf || !wf.isActive) return

    const entry: RegisteredWorkflow = { cronTasks: [], eventHandlers: [] }

    if (wf.triggerType === WorkflowTriggerType.SCHEDULE) {
      const config = wf.triggerConfig as { cronExpression?: string; timezone?: string }
      const cronExpression = config.cronExpression ?? MONTH_END_CRON
      const task = this.registerSchedule(workflowId, wf.tenantId, cronExpression)
      if (task) entry.cronTasks.push(task)
    }

    if (wf.triggerType === WorkflowTriggerType.EVENT) {
      const config = wf.triggerConfig as { eventType?: SaiosEventType }
      if (config.eventType) {
        const handler = this.registerEventListener(workflowId, wf.tenantId, config.eventType)
        entry.eventHandlers.push({ type: config.eventType, handler })
      }
    }

    if (wf.triggerType === WorkflowTriggerType.WEBHOOK && !wf.webhookToken) {
      await prisma.workflowDefinition.update({
        where: { id: workflowId },
        data: { webhookToken: generateWebhookToken() },
      })
    }

    registry.set(workflowId, entry)
  }

  registerSchedule(workflowId: string, tenantId: string, cronExpression: string): CronTask | null {
    if (!cron.validate(cronExpression)) {
      console.warn(`[TriggerManager] Invalid cron for workflow ${workflowId}: ${cronExpression}`)
      return null
    }

    return cron.schedule(cronExpression, () => {
      void workflowEngine.execute(workflowId, { tenantId, scheduled: true }, {
        triggeredBy: 'schedule',
      })
    })
  }

  registerEventListener(
    workflowId: string,
    tenantId: string,
    eventType: SaiosEventType,
  ): EventHandler {
    const handler = (payload: SaiosEventPayload) => {
      if (payload.tenantId !== tenantId) return
      void workflowEngine.execute(workflowId, payload.data, { triggeredBy: `event:${eventType}` })
    }
    saiosEventBus.onEvent(eventType, handler)
    return handler
  }

  async deregisterAll(workflowId: string): Promise<void> {
    const entry = registry.get(workflowId)
    if (!entry) return

    for (const task of entry.cronTasks) {
      task.stop()
    }
    for (const { type, handler } of entry.eventHandlers) {
      saiosEventBus.offEvent(type, handler)
    }
    registry.delete(workflowId)
  }

  async activateWorkflow(workflowId: string): Promise<void> {
    await prisma.workflowDefinition.update({
      where: { id: workflowId },
      data: { isActive: true },
    })
    await this.registerWorkflow(workflowId)
  }

  async deactivateWorkflow(workflowId: string): Promise<void> {
    await this.deregisterAll(workflowId)
    await prisma.workflowDefinition.update({
      where: { id: workflowId },
      data: { isActive: false },
    })
  }

  getWebhookUrl(webhookToken: string): string {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    return `${base}/api/workflows/webhook/${webhookToken}`
  }
}

export const triggerManager = new TriggerManager()

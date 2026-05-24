import { createHash, randomBytes } from 'crypto'
import cron from 'node-cron'
import { WorkflowTriggerType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { workflowEngine } from './core/WorkflowEngine'
import { saiosEventBus, type SaiosEventPayload, type SaiosEventType } from './eventBus'
import '@/lib/workflows/nodes'

type CronTask = ReturnType<typeof cron.schedule>
type EventHandler = (payload: SaiosEventPayload) => void

interface RegisteredWorkflow {
  cronTasks: CronTask[]
  eventHandlers: Array<{ type: SaiosEventType; handler: EventHandler }>
}

const registry = new Map<string, RegisteredWorkflow>()
let initialized = false

function generateWebhookToken(): string {
  return createHash('sha256').update(randomBytes(32)).digest('hex').slice(0, 32)
}

/**
 * Module 06 — workflow event triggers.
 *
 * Inventory events (Module 12) emitted via inventoryWebhooks:
 * - stock_level_changed — every stockEngine transaction
 * - stock_below_reorder — stock falls at/below reorderPoint (also emits legacy low_stock)
 * - po_status_changed — purchase order status transitions
 */
export class TriggerManager {
  async initialize(): Promise<void> {
    if (initialized) return
    initialized = true

    const active = await prisma.workflowDefinition.findMany({
      where: { isActive: true },
    })

    for (const wf of active) {
      await this.registerWorkflow(wf.id)
    }
  }

  async registerWorkflow(workflowId: string): Promise<void> {
    await this.deregisterAll(workflowId)

    const wf = await prisma.workflowDefinition.findUnique({ where: { id: workflowId } })
    if (!wf || !wf.isActive) return

    const entry: RegisteredWorkflow = { cronTasks: [], eventHandlers: [] }

    if (wf.triggerType === WorkflowTriggerType.SCHEDULE) {
      const config = wf.triggerConfig as { cronExpression?: string; timezone?: string }
      if (config.cronExpression) {
        const task = this.registerSchedule(workflowId, wf.tenantId, config.cronExpression)
        if (task) entry.cronTasks.push(task)
      }
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
      console.warn(`[TriggerManager] Invalid cron for workflow ${workflowId}`)
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

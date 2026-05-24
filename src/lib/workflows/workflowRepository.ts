import { WorkflowExecutionStatus, WorkflowTriggerType, type Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { createHash, randomBytes } from 'crypto'
import type { WorkflowDefinitionJSON } from './types'
import { getTemplateById, listTemplates } from './templates/templateLoader'
import { triggerManager } from './TriggerManager'

function webhookToken(): string {
  return createHash('sha256').update(randomBytes(32)).digest('hex').slice(0, 32)
}

export class WorkflowRepository {
  async list(tenantId: string) {
    const workflows = await prisma.workflowDefinition.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { executions: true } },
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, createdAt: true, completedAt: true },
        },
      },
    })

    return workflows.map((w: (typeof workflows)[number]) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      triggerType: w.triggerType,
      isActive: w.isActive,
      version: w.version,
      status: w.isActive ? ('active' as const) : ('draft' as const),
      executionCount: w._count.executions,
      lastExecution: w.executions[0] ?? null,
      updatedAt: w.updatedAt.toISOString(),
      webhookToken: w.webhookToken,
    }))
  }

  async get(tenantId: string, id: string) {
    const w = await prisma.workflowDefinition.findFirst({
      where: { id, tenantId },
    })
    if (!w) return null
    return {
      ...w,
      nodes: w.nodes as Prisma.JsonArray,
      edges: w.edges as Prisma.JsonArray,
      triggerConfig: w.triggerConfig as Record<string, unknown>,
    }
  }

  async create(
    tenantId: string,
    data: {
      name: string
      description?: string
      triggerType?: WorkflowTriggerType
      triggerConfig?: Record<string, unknown>
      nodes?: unknown[]
      edges?: unknown[]
      templateId?: string
      createdBy?: string
    },
  ) {
    let definition: WorkflowDefinitionJSON | undefined

    if (data.templateId) {
      definition = getTemplateById(data.templateId)
      if (!definition) throw new Error('Template not found')
    }

    const triggerType = (definition?.triggerType as WorkflowTriggerType) ?? data.triggerType ?? 'MANUAL'

    return prisma.workflowDefinition.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description ?? definition?.nodes?.[0]?.data?.label,
        triggerType,
        triggerConfig: (definition?.triggerConfig ?? data.triggerConfig ?? {}) as Prisma.InputJsonValue,
        nodes: (definition?.nodes ?? data.nodes ?? []) as Prisma.InputJsonValue,
        edges: (definition?.edges ?? data.edges ?? []) as Prisma.InputJsonValue,
        createdBy: data.createdBy,
        webhookToken: triggerType === 'WEBHOOK' ? webhookToken() : null,
      },
    })
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const existing = await prisma.workflowDefinition.findFirst({ where: { id, tenantId } })
    if (!existing) throw new Error('Workflow not found')

    return prisma.workflowDefinition.update({
      where: { id },
      data: {
        ...(data.name != null ? { name: String(data.name) } : {}),
        ...(data.description != null ? { description: String(data.description) } : {}),
        ...(data.triggerType != null ? { triggerType: data.triggerType as WorkflowTriggerType } : {}),
        ...(data.triggerConfig != null ? { triggerConfig: data.triggerConfig as Prisma.InputJsonValue } : {}),
        ...(data.nodes != null ? { nodes: data.nodes as Prisma.InputJsonValue, version: { increment: 1 } } : {}),
        ...(data.edges != null ? { edges: data.edges as Prisma.InputJsonValue } : {}),
      },
    })
  }

  async delete(tenantId: string, id: string) {
    const existing = await prisma.workflowDefinition.findFirst({ where: { id, tenantId } })
    if (!existing) throw new Error('Workflow not found')
    if (existing.isActive) {
      await triggerManager.deactivateWorkflow(id)
    }
    await prisma.workflowDefinition.delete({ where: { id } })
  }

  async setActive(tenantId: string, id: string, isActive: boolean) {
    const existing = await prisma.workflowDefinition.findFirst({ where: { id, tenantId } })
    if (!existing) throw new Error('Workflow not found')

    return prisma.workflowDefinition.update({
      where: { id },
      data: { isActive },
    })
  }

  async listExecutions(tenantId: string, workflowId: string, status?: string, limit = 20) {
    return prisma.workflowExecution.findMany({
      where: {
        tenantId,
        workflowDefinitionId: workflowId,
        ...(status && status !== 'all' ? { status: status as WorkflowExecutionStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async getExecution(tenantId: string, execId: string) {
    return prisma.workflowExecution.findFirst({
      where: { id: execId, tenantId },
      include: {
        nodeExecutions: { orderBy: { startedAt: 'asc' } },
        definition: { select: { name: true, nodes: true } },
      },
    })
  }

  async getAnalytics(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400_000)
    const executions = await prisma.workflowExecution.findMany({
      where: { tenantId, createdAt: { gte: since } },
      select: {
        id: true,
        status: true,
        workflowDefinitionId: true,
        startedAt: true,
        completedAt: true,
        definition: { select: { name: true } },
      },
    })

    const total = executions.length
    const completed = executions.filter((e: { status: string }) => e.status === 'COMPLETED').length
    const failed = executions.filter((e: { status: string }) => e.status === 'FAILED').length
    const durations = executions
      .filter((e: { startedAt: Date | null; completedAt: Date | null }) => e.startedAt && e.completedAt)
      .map((e: { startedAt: Date | null; completedAt: Date | null }) => e.completedAt!.getTime() - e.startedAt!.getTime())

    const avgDurationMs = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0

    const byWorkflow = new Map<string, number>()
    for (const e of executions) {
      byWorkflow.set(e.workflowDefinitionId, (byWorkflow.get(e.workflowDefinitionId) ?? 0) + 1)
    }

    const mostTriggered = Array.from(byWorkflow.entries())
      .map(([workflowDefinitionId, count]) => ({
        workflowDefinitionId,
        count,
        name: executions.find((e: { workflowDefinitionId: string }) => e.workflowDefinitionId === workflowDefinitionId)?.definition.name ?? '',
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const dailySuccess = new Map<string, { success: number; total: number }>()
    for (const e of executions) {
      const day = e.startedAt?.toISOString().slice(0, 10) ?? 'unknown'
      const cur = dailySuccess.get(day) ?? { success: 0, total: 0 }
      cur.total++
      if (e.status === 'COMPLETED') cur.success++
      dailySuccess.set(day, cur)
    }

    return {
      total,
      successRate: total ? completed / total : 0,
      failureRate: total ? failed / total : 0,
      avgDurationMs,
      mostTriggered,
      dailySuccess: Array.from(dailySuccess.entries()).map(([date, v]) => ({
        date,
        successRate: v.total ? v.success / v.total : 0,
        total: v.total,
      })),
    }
  }

  listTemplates() {
    return listTemplates()
  }

  async findByWebhookToken(token: string) {
    return prisma.workflowDefinition.findFirst({
      where: { webhookToken: token, isActive: true, triggerType: 'WEBHOOK' },
    })
  }
}

export const workflowRepository = new WorkflowRepository()

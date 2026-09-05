import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getQueueStats } from '@/lib/queue/agentQueue'
import type { AgentStatusInfo, AgentTypeKey } from '@/lib/agents/core/types'
import { AGENT_TYPE_MAP } from '@/lib/agents/core/types'

const AGENT_TYPES: AgentTypeKey[] = ['finance', 'sales', 'inventory', 'operations', 'executive']

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [logs, processingTasks, queueStats] = await Promise.all([
      prisma.agentLog.findMany({
        where: { tenantId: auth.tenantId, createdAt: { gte: todayStart } },
        select: { agentType: true, createdAt: true, status: true, action: true, result: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.agentTask.findMany({
        where: { tenantId: auth.tenantId, status: 'PROCESSING' },
        select: { id: true, agentType: true, startedAt: true },
      }),
      getQueueStats(),
    ])

    const agents: AgentStatusInfo[] = AGENT_TYPES.map((type) => {
      const prismaType = AGENT_TYPE_MAP[type]
      const typeLogs = logs.filter((l) => l.agentType === prismaType)
      const processing = processingTasks.find((t) => t.agentType === prismaType)
      // Ignore spurious LLM "null" tool failures that used to flip the Error badge.
      const meaningfulLogs = typeLogs.filter((l) => {
        if (l.status !== 'FAILURE') return true
        if (l.action === 'null' || l.action === 'none') return false
        const result = l.result as { error?: string } | null
        if (typeof result?.error === 'string' && /unknown tool:\s*null/i.test(result.error)) {
          return false
        }
        return true
      })
      const latest = meaningfulLogs[0]

      let status: AgentStatusInfo['status'] = 'idle'
      if (processing) status = 'processing'
      else if (latest?.status === 'FAILURE') status = 'error'
      else if (meaningfulLogs.length > 0) status = 'active'

      return {
        agentType: type,
        agentId: `${type}-agent-${auth.tenantId.slice(0, 8)}`,
        status,
        tasksCompletedToday: typeLogs.filter((l) => l.status === 'SUCCESS').length,
        lastActivityAt: (meaningfulLogs[0] ?? typeLogs[0])?.createdAt.toISOString() ?? null,
        currentTaskId: processing?.id,
      }
    })

    const avgProcessingMs = await prisma.agentLog.aggregate({
      where: { tenantId: auth.tenantId, durationMs: { not: null } },
      _avg: { durationMs: true },
    })

    return NextResponse.json(
      apiSuccess({
        agents,
        queue: queueStats,
        metrics: {
          avgProcessingMs: Math.round(avgProcessingMs._avg.durationMs ?? 0),
          totalTasksToday: logs.length,
          activeTasks: processingTasks.length,
        },
      }),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { createAgentTaskSchema } from '@/lib/agents/schemas'
import { getOrchestrator } from '@/lib/agents/core/AgentOrchestrator'
import { AGENT_TYPE_MAP } from '@/lib/agents/core/types'
import type { AgentTypeKey } from '@/lib/agents/core/types'
import {
  enqueueAgentTask,
  processAgentTaskInline,
} from '@/lib/queue/agentQueue'

export const runtime = 'nodejs'

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = createAgentTaskSchema.parse(await request.json())
    const tenantId = body.tenantId ?? auth.tenantId
    const userId = body.userId ?? auth.userId

    const orchestrator = getOrchestrator(tenantId)
    const preferredAgent = body.preferredAgent as AgentTypeKey | undefined
    const isComplex = orchestrator.isComplexTask(body.task, preferredAgent)

    const taskRecord = await prisma.agentTask.create({
      data: {
        tenantId,
        userId,
        task: body.task,
        agentType: preferredAgent ? AGENT_TYPE_MAP[preferredAgent] : undefined,
        priority: body.priority,
        status: isComplex ? 'PENDING' : 'PROCESSING',
      },
    })

    const jobData = {
      taskId: taskRecord.id,
      tenantId,
      userId,
      task: body.task,
      preferredAgent,
      permissions: auth.permissions,
      priority: body.priority,
    }

    if (isComplex) {
      const jobId = await enqueueAgentTask(jobData)

      if (jobId) {
        return NextResponse.json(
          apiSuccess({ taskId: taskRecord.id, status: 'processing' as const }),
          { status: 202 },
        )
      }

      processAgentTaskInline(jobData).catch(console.error)
      return NextResponse.json(
        apiSuccess({ taskId: taskRecord.id, status: 'processing' as const }),
        { status: 202 },
      )
    }

    const result = await orchestrator.executeTask(
      {
        task: body.task,
        userId,
        taskId: taskRecord.id,
        permissions: auth.permissions,
      },
      preferredAgent,
    )

    await prisma.agentTask.update({
      where: { id: taskRecord.id },
      data: {
        status: 'COMPLETED',
        result: result.response as never,
        agentType: AGENT_TYPE_MAP[result.primaryAgent],
        completedAt: new Date(),
      },
    })

    return NextResponse.json(
      apiSuccess({
        taskId: taskRecord.id,
        status: 'completed' as const,
        result: result.response,
        primaryAgent: result.primaryAgent,
        involvedAgents: result.involvedAgents,
      }),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

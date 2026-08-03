import { NextResponse } from 'next/server'
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
  shouldUseAsyncAgentQueue,
} from '@/lib/queue/agentQueue'

export const runtime = 'nodejs'
/** Allow long LLM agent runs on platforms that honor this (Vercel Pro+). */
export const maxDuration = 60

export const POST = withTenantAuth(async (request, { auth }) => {
  let taskId: string | null = null

  try {
    const body = createAgentTaskSchema.parse(await request.json())
    const tenantId = body.tenantId ?? auth.tenantId
    const userId = body.userId ?? auth.userId

    const orchestrator = getOrchestrator(tenantId)
    const preferredAgent = body.preferredAgent as AgentTypeKey | undefined
    const isComplex = orchestrator.isComplexTask(body.task, preferredAgent)
    const useAsyncQueue = isComplex && shouldUseAsyncAgentQueue()

    const taskRecord = await prisma.agentTask.create({
      data: {
        tenantId,
        userId,
        task: body.task,
        agentType: preferredAgent ? AGENT_TYPE_MAP[preferredAgent] : undefined,
        priority: body.priority,
        status: 'PENDING',
      },
    })
    taskId = taskRecord.id

    const jobData = {
      taskId: taskRecord.id,
      tenantId,
      userId,
      task: body.task,
      preferredAgent,
      permissions: auth.permissions,
      priority: body.priority,
    }

    // Only enqueue when a dedicated Redis worker is explicitly enabled.
    // Otherwise await inline — fire-and-forget dies on Vercel serverless.
    if (useAsyncQueue) {
      const jobId = await enqueueAgentTask(jobData)
      if (jobId) {
        return NextResponse.json(
          apiSuccess({ taskId: taskRecord.id, status: 'processing' as const }),
          { status: 202 },
        )
      }
    }

    const outcome = await processAgentTaskInline(jobData)

    if (outcome.status === 'COMPLETED') {
      return NextResponse.json(
        apiSuccess({
          taskId: outcome.taskId,
          status: 'completed' as const,
          result: outcome.result,
          primaryAgent: outcome.primaryAgent,
          involvedAgents: outcome.involvedAgents,
        }),
      )
    }

    return NextResponse.json(
      apiSuccess({
        taskId: outcome.taskId,
        status: 'failed' as const,
        error: outcome.error ?? 'Agent task failed',
      }),
      { status: 500 },
    )
  } catch (err) {
    if (taskId) {
      try {
        await prisma.agentTask.update({
          where: { id: taskId },
          data: {
            status: 'FAILED',
            error: err instanceof Error ? err.message : 'Task failed',
            completedAt: new Date(),
          },
        })
      } catch {
        /* ignore secondary failure */
      }
    }
    return handleRouteError(err)
  }
})

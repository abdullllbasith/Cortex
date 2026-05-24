import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, apiError } from '@/lib/knowledge/response'
import type { AgentTaskStep } from '@/lib/agents/core/types'
import { processAgentTaskInline } from '@/lib/queue/agentQueue'
import { PRISMA_TO_AGENT_KEY } from '@/lib/agents/core/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withTenantAuth(async (request, { params, auth }) => {
  try {
    const { taskId } = await params
    const query = parseQuery(request)
    const stream = query.stream === 'true'

    const task = await prisma.agentTask.findFirst({
      where: { id: taskId, tenantId: auth.tenantId },
    })

    if (!task) {
      return apiError('Task not found', 'NOT_FOUND', 404)
    }

    if (stream && (task.status === 'PENDING' || task.status === 'PROCESSING')) {
      const streamBody = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          let lastStepCount = 0
          let attempts = 0
          const maxAttempts = 120

          const poll = async () => {
            const current = await prisma.agentTask.findUnique({ where: { id: taskId } })
            if (!current) {
              controller.close()
              return
            }

            const steps = (current.steps as unknown as AgentTaskStep[]) ?? []
            for (let i = lastStepCount; i < steps.length; i++) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'step', step: steps[i] })}\n\n`),
              )
            }
            lastStepCount = steps.length

            if (current.status === 'COMPLETED') {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'complete', result: current.result, status: 'completed' })}\n\n`,
                ),
              )
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
              return
            }

            if (current.status === 'FAILED' || current.status === 'DEAD_LETTER') {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'error', error: current.error, status: current.status })}\n\n`,
                ),
              )
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
              return
            }

            attempts++
            if (attempts >= maxAttempts) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
              return
            }

            setTimeout(poll, 1000)
          }

          if (task.status === 'PENDING') {
            const preferred = task.agentType ? PRISMA_TO_AGENT_KEY[task.agentType] : undefined
            processAgentTaskInline({
              taskId: task.id,
              tenantId: task.tenantId,
              userId: task.userId,
              task: task.task,
              preferredAgent: preferred ?? undefined,
              permissions: auth.permissions,
              priority: task.priority,
            }).catch(console.error)
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'status', status: task.status })}\n\n`),
          )
          poll()
        },
      })

      return new NextResponse(streamBody, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    return NextResponse.json(
      apiSuccess({
        taskId: task.id,
        status: task.status.toLowerCase(),
        task: task.task,
        agentType: task.agentType ? PRISMA_TO_AGENT_KEY[task.agentType] : null,
        result: task.result,
        steps: task.steps,
        error: task.error,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
      }),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

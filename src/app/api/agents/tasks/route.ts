import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { PRISMA_TO_AGENT_KEY } from '@/lib/agents/core/types'
import { reclaimStuckAgentTasks } from '@/lib/queue/agentQueue'
import { z } from 'zod'

const querySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
})

const deleteSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('one'), taskId: z.string().min(1) }),
  z.object({
    mode: z.literal('completed'),
    /** Also remove failed / dead-letter when clearing the finished batch */
    includeFailed: z.boolean().optional().default(true),
  }),
])

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = querySchema.parse(parseQuery(request))

    // Clear tasks abandoned by serverless timeouts / missing Redis workers.
    await reclaimStuckAgentTasks(auth.tenantId)

    const tasks = await prisma.agentTask.findMany({
      where: {
        tenantId: auth.tenantId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: query.limit,
      select: {
        id: true,
        task: true,
        agentType: true,
        priority: true,
        status: true,
        userId: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        error: true,
      },
    })

    return NextResponse.json(
      apiSuccess(
        tasks.map((t) => {
          const start = t.startedAt ?? t.createdAt
          const end = t.completedAt ?? new Date()
          return {
            ...t,
            agentType: t.agentType ? PRISMA_TO_AGENT_KEY[t.agentType] : null,
            elapsedMs: end.getTime() - start.getTime(),
          }
        }),
      ),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = withTenantAuth(async (request, { auth }) => {
  try {
    const body = deleteSchema.parse(await request.json())

    if (body.mode === 'one') {
      const existing = await prisma.agentTask.findFirst({
        where: { id: body.taskId, tenantId: auth.tenantId },
        select: { id: true, status: true },
      })
      if (!existing) {
        return NextResponse.json(
          { success: false, error: { message: 'Task not found' } },
          { status: 404 },
        )
      }
      if (existing.status === 'PENDING' || existing.status === 'PROCESSING') {
        return NextResponse.json(
          { success: false, error: { message: 'Cannot clear an active task' } },
          { status: 400 },
        )
      }
      await prisma.agentTask.delete({ where: { id: existing.id } })
      return NextResponse.json(apiSuccess({ deleted: 1, ids: [existing.id] }))
    }

    const statuses = body.includeFailed
      ? (['COMPLETED', 'FAILED', 'DEAD_LETTER'] as const)
      : (['COMPLETED'] as const)

    const result = await prisma.agentTask.deleteMany({
      where: {
        tenantId: auth.tenantId,
        status: { in: [...statuses] },
      },
    })

    return NextResponse.json(apiSuccess({ deleted: result.count }))
  } catch (err) {
    return handleRouteError(err)
  }
})

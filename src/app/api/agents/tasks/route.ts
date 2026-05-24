import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { PRISMA_TO_AGENT_KEY } from '@/lib/agents/core/types'
import { z } from 'zod'

const querySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
})

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = querySchema.parse(parseQuery(request))

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
        tasks.map((t) => ({
          ...t,
          agentType: t.agentType ? PRISMA_TO_AGENT_KEY[t.agentType] : null,
          elapsedMs: t.startedAt
            ? ((t.completedAt ?? new Date()).getTime() - t.startedAt.getTime())
            : null,
        })),
      ),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

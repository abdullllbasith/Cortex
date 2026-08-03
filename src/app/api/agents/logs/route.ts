import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { agentLogsQuerySchema } from '@/lib/agents/schemas'
import { AGENT_TYPE_MAP, PRISMA_TO_AGENT_KEY } from '@/lib/agents/core/types'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = agentLogsQuerySchema.parse(parseQuery(request))

    const where = {
      tenantId: auth.tenantId,
      ...(query.agentType ? { agentType: AGENT_TYPE_MAP[query.agentType] } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    }

    const [data, total] = await Promise.all([
      prisma.agentLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.agentLog.count({ where }),
    ])

    return NextResponse.json(
      apiSuccess(
        data.map((log) => ({
          id: log.id,
          agentId: log.agentId,
          agentType: PRISMA_TO_AGENT_KEY[log.agentType],
          action: log.action,
          input: log.input,
          result: log.result,
          status: log.status,
          durationMs: log.durationMs,
          userId: log.userId,
          taskId: log.taskId,
          createdAt: log.createdAt,
        })),
        paginatedMeta(query.page, query.limit, total),
      ),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

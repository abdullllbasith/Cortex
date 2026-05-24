import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta, apiError } from '@/lib/knowledge/response'
import { messageListSchema } from '@/lib/assistant/schemas'
import { getSession, getMessageHistory } from '@/lib/assistant/conversationMemory'

export const GET = withTenantAuth(async (request, { params, auth }) => {
  try {
    const { sessionId } = await params
    const query = messageListSchema.parse(parseQuery(request))

    const session = await getSession(auth.tenantId, sessionId, auth.userId)
    if (!session) {
      return apiError('Session not found', 'NOT_FOUND', 404)
    }

    const { messages, total } = await getMessageHistory(auth.tenantId, sessionId, {
      page: query.page,
      limit: query.limit,
    })

    return NextResponse.json(
      apiSuccess(
        messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          intent: m.intent,
          confidence: m.confidence,
          sourcesUsed: m.sourcesUsed ?? [],
          actionsTaken: m.actionsTaken ?? [],
          suggestedFollowUps: m.suggestedFollowUps ?? [],
          createdAt: m.createdAt,
        })),
        paginatedMeta(query.page, query.limit, total),
      ),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

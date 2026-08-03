import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { createSessionSchema, sessionListSchema } from '@/lib/assistant/schemas'
import { listSessions, createSession, archiveSession } from '@/lib/assistant/conversationMemory'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = sessionListSchema.parse(parseQuery(request))
    const { data, total } = await listSessions(auth.tenantId, auth.userId, {
      page: query.page,
      limit: query.limit,
      archived: query.archived,
    })

    return NextResponse.json(
      apiSuccess(
        data.map((s) => ({
          id: s.id,
          title: s.title,
          channel: s.channel,
          archived: s.archived,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          lastMessage: s.messages[0]
            ? {
                content: s.messages[0].content.slice(0, 120),
                role: s.messages[0].role,
                createdAt: s.messages[0].createdAt,
              }
            : null,
        })),
        paginatedMeta(query.page, query.limit, total),
      ),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = createSessionSchema.parse(await request.json())
    const session = await createSession(
      auth.tenantId,
      auth.userId,
      body.title ?? 'New conversation',
      body.channel,
    )

    return NextResponse.json(apiSuccess(session), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = withTenantAuth(async (request, { auth }) => {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId')
    if (!sessionId) {
      return handleRouteError(new Error('sessionId required'))
    }

    const archived = await archiveSession(auth.tenantId, sessionId, auth.userId)
    if (!archived) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Session not found' } },
        { status: 404 },
      )
    }

    return NextResponse.json(apiSuccess({ id: sessionId, archived: true }))
  } catch (err) {
    return handleRouteError(err)
  }
})

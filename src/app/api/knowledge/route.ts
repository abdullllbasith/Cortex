import { NextResponse } from 'next/server'
import { BusinessKnowledgeType } from '@prisma/client'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { knowledgeRepository } from '@/lib/knowledge/knowledgeRepository'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { knowledgeCreateSchema, paginationSchema } from '@/lib/knowledge/schemas'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const raw = parseQuery(request)
    const query = paginationSchema.parse(raw)
    const type = raw.type as BusinessKnowledgeType | undefined
    const { data, total } = await knowledgeRepository.listKnowledge(auth.tenantId, { ...query, type })
    return NextResponse.json(apiSuccess(data, paginatedMeta(query.page, query.limit, total)))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = knowledgeCreateSchema.parse(await request.json())
    const record = await knowledgeRepository.createKnowledge(auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

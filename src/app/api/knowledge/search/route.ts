import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { knowledgeRepository } from '@/lib/knowledge/knowledgeRepository'
import { apiSuccess } from '@/lib/knowledge/response'
import { semanticSearchSchema } from '@/lib/knowledge/schemas'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = semanticSearchSchema.parse(parseQuery(request))
    const results = await knowledgeRepository.search(
      auth.tenantId,
      query.query,
      query.entityType,
      query.topK,
    )
    return NextResponse.json(apiSuccess(results, { count: results.length, query: query.query }))
  } catch (err) {
    return handleRouteError(err)
  }
})

import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { findSimilarEntities } from '@/lib/embeddings/semanticSearch'
import { apiSuccess } from '@/lib/knowledge/response'
import { z } from 'zod'

const schema = z.object({
  entityType: z.enum(['customer', 'product', 'supplier', 'knowledge']),
  entityId: z.string().min(1),
  topK: z.coerce.number().int().min(1).max(20).default(5),
})

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = schema.parse(parseQuery(request))
    const results = await findSimilarEntities(
      auth.tenantId,
      query.entityType,
      query.entityId,
      query.topK,
    )
    return NextResponse.json(apiSuccess(results))
  } catch (err) {
    return handleRouteError(err)
  }
})

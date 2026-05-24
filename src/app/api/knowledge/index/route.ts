import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { indexAllTenantKnowledge, indexTenantEntities } from '@/lib/embeddings/knowledgeIndexer'
import { apiSuccess } from '@/lib/knowledge/response'
import { indexRequestSchema } from '@/lib/knowledge/schemas'

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = indexRequestSchema.parse(await request.json().catch(() => ({})))

    if (body.entityTypes?.length) {
      const results = await Promise.all(
        body.entityTypes.map((type) => indexTenantEntities(auth.tenantId, type)),
      )
      return NextResponse.json(apiSuccess(results))
    }

    const results = await indexAllTenantKnowledge(auth.tenantId)
    return NextResponse.json(apiSuccess(results))
  } catch (err) {
    return handleRouteError(err)
  }
})

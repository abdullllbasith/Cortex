import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { dealMoveSchema } from '@/lib/crm/crmSchemas'
import { moveDeal } from '@/lib/crm/pipelineService'

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = dealMoveSchema.parse(await request.json())
    const record = await moveDeal(id, body.stageId, auth.tenantId, auth.userId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

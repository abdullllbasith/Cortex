import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { dealLostSchema } from '@/lib/crm/crmSchemas'
import { lostDeal } from '@/lib/crm/pipelineService'

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = dealLostSchema.parse(await request.json())
    const record = await lostDeal(id, auth.tenantId, body.reason, auth.userId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { dealWonSchema } from '@/lib/crm/crmSchemas'
import { wonDeal } from '@/lib/crm/pipelineService'

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = dealWonSchema.parse(await request.json().catch(() => ({})))
    const record = await wonDeal(id, auth.tenantId, body.actualValue, auth.userId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

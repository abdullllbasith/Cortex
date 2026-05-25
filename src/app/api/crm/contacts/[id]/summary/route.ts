import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { generateContactInsights } from '@/lib/crm/crmAgentService'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const insights = await generateContactInsights(auth.tenantId, id)
    return NextResponse.json(apiSuccess(insights))
  } catch (err) {
    return handleRouteError(err)
  }
})

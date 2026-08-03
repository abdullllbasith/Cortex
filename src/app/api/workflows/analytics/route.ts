import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { workflowRepository } from '@/lib/workflows/workflowRepository'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const days = parseInt(request.nextUrl.searchParams.get('days') ?? '30', 10)
    const data = await workflowRepository.getAnalytics(auth.tenantId, days)
    return NextResponse.json(apiSuccess(data))
  } catch (err) {
    return handleRouteError(err)
  }
})

import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { workflowRepository } from '@/lib/workflows/workflowRepository'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    void auth
    const templates = workflowRepository.listTemplates()
    return NextResponse.json(apiSuccess(templates))
  } catch (err) {
    return handleRouteError(err)
  }
})

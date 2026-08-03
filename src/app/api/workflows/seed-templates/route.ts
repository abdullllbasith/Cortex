import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { seedAllWorkflowTemplatesForTenant } from '@/lib/workflows/workflowTemplateSeed'
import '@/lib/workflows/nodes'

/** Ensure all canonical workflow templates exist for the current tenant. */
export const POST = withTenantAuth(async (_request, { auth }) => {
  try {
    const ids = await seedAllWorkflowTemplatesForTenant(auth.tenantId, auth.userId)
    return NextResponse.json(apiSuccess({ count: ids.length, ids }))
  } catch (err) {
    return handleRouteError(err)
  }
}, { resourceType: 'workflow' })

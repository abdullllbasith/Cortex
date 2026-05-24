import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { createWorkflowSchema } from '@/lib/workflows/schemas'
import { workflowRepository } from '@/lib/workflows/workflowRepository'
import '@/lib/workflows/nodes'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const data = await workflowRepository.list(auth.tenantId)
    return NextResponse.json(apiSuccess(data))
  } catch (err) {
    return handleRouteError(err)
  }
}, { resourceType: 'workflow' })

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = createWorkflowSchema.parse(await request.json())
    const workflow = await workflowRepository.create(auth.tenantId, {
      ...body,
      createdBy: auth.userId,
    })
    return NextResponse.json(apiSuccess(workflow), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
}, { resourceType: 'workflow' })

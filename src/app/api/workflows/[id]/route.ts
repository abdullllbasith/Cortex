import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { updateWorkflowSchema } from '@/lib/workflows/schemas'
import { workflowRepository } from '@/lib/workflows/workflowRepository'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const data = await workflowRepository.get(auth.tenantId, id)
    if (!data) return NextResponse.json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } }, { status: 404 })
    return NextResponse.json(apiSuccess(data))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = updateWorkflowSchema.parse(await request.json())
    const data = await workflowRepository.update(auth.tenantId, id, body)
    return NextResponse.json(apiSuccess(data))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    await workflowRepository.delete(auth.tenantId, id)
    return NextResponse.json(apiSuccess({ deleted: true }))
  } catch (err) {
    return handleRouteError(err)
  }
})

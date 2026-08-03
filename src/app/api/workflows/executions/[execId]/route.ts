import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { workflowRepository } from '@/lib/workflows/workflowRepository'
import { workflowEngine } from '@/lib/workflows/core/WorkflowEngine'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { execId } = await params
    const execution = await workflowRepository.getExecution(auth.tenantId, execId)
    if (!execution) {
      return NextResponse.json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } }, { status: 404 })
    }
    return NextResponse.json(apiSuccess(execution))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { execId } = await params
    const body = await request.json().catch(() => ({})) as { nodeId?: string }
    if (!body.nodeId) return handleRouteError(new Error('nodeId required'))

    const execution = await workflowRepository.getExecution(auth.tenantId, execId)
    if (!execution) return handleRouteError(new Error('Execution not found'))

    const result = await workflowEngine.retryNode(execId, body.nodeId)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

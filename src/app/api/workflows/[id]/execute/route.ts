import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess, apiError } from '@/lib/knowledge/response'
import { executeWorkflowSchema } from '@/lib/workflows/schemas'
import { workflowRepository } from '@/lib/workflows/workflowRepository'
import { workflowEngine } from '@/lib/workflows/core/WorkflowEngine'
import '@/lib/workflows/nodes'

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const workflow = await workflowRepository.get(auth.tenantId, id)
    if (!workflow) return apiError('Workflow not found', 'NOT_FOUND', 404)

    const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : []
    if (!nodes.length) {
      return apiError('Workflow has no nodes. Add at least one node before running.', 'VALIDATION_ERROR', 400)
    }

    const body = executeWorkflowSchema.parse(await request.json().catch(() => ({})))
    const result = await workflowEngine.execute(id, body.inputData ?? {}, {
      triggeredBy: auth.userId,
    })
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

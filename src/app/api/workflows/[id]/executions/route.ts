import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { executionListQuerySchema } from '@/lib/workflows/schemas'
import { workflowRepository } from '@/lib/workflows/workflowRepository'

export const GET = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const query = executionListQuerySchema.parse(parseQuery(request))
    const executions = await workflowRepository.listExecutions(
      auth.tenantId,
      id,
      query.status,
      query.limit,
    )
    return NextResponse.json(apiSuccess(executions.map(mapExecution)))
  } catch (err) {
    return handleRouteError(err)
  }
})

function mapExecution(e: Awaited<ReturnType<typeof workflowRepository.listExecutions>>[number]) {
  const duration = e.startedAt && e.completedAt
    ? `${Math.round((e.completedAt.getTime() - e.startedAt.getTime()) / 1000)}s`
    : undefined
  return {
    id: e.id,
    workflowId: e.workflowDefinitionId,
    status: e.status === 'COMPLETED' ? 'success' : e.status === 'FAILED' ? 'failed' : 'running',
    rawStatus: e.status,
    startedAt: e.startedAt?.toISOString() ?? e.createdAt.toISOString(),
    completedAt: e.completedAt?.toISOString(),
    duration,
    triggeredBy: e.triggeredBy,
    errorMessage: e.errorMessage,
  }
}

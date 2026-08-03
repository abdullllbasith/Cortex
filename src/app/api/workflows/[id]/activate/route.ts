import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { activateWorkflowSchema } from '@/lib/workflows/schemas'
import { workflowRepository } from '@/lib/workflows/workflowRepository'
import { triggerManager } from '@/lib/workflows/TriggerManager'

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = activateWorkflowSchema.parse(await request.json())

    await workflowRepository.setActive(auth.tenantId, id, body.isActive)

    if (body.isActive) {
      await triggerManager.activateWorkflow(id)
    } else {
      await triggerManager.deactivateWorkflow(id)
    }

    return NextResponse.json(apiSuccess({ id, isActive: body.isActive }))
  } catch (err) {
    return handleRouteError(err)
  }
})

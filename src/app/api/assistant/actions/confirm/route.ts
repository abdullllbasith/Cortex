import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { executeConfirmedAction } from '@/lib/assistant/actionHandlers'
import type { ActionTaken } from '@/lib/assistant/types'

const confirmSchema = z.object({
  action: z.object({
    id: z.string(),
    type: z.string(),
    description: z.string(),
    status: z.enum(['awaiting_confirmation', 'pending', 'completed', 'failed', 'cancelled']),
    requiresConfirmation: z.boolean().optional(),
    executePayload: z.record(z.string(), z.unknown()).optional(),
    displayTitle: z.string().optional(),
    parameters: z
      .array(z.object({ label: z.string(), value: z.string() }))
      .optional(),
    entityType: z.string().optional(),
    entityId: z.string().optional(),
  }),
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = confirmSchema.parse(await request.json())
    const action = body.action as ActionTaken

    if (action.status !== 'awaiting_confirmation' && !action.requiresConfirmation) {
      return NextResponse.json(
        apiSuccess({ action: { ...action, status: 'completed' as const } }),
      )
    }

    const result = await executeConfirmedAction(auth.tenantId, auth.userId, action)
    return NextResponse.json(apiSuccess({ action: result }))
  } catch (err) {
    return handleRouteError(err)
  }
})

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { undoAction } from '@/lib/assistant/actionHandlers'
import type { ActionTaken } from '@/lib/assistant/types'

const undoSchema = z.object({
  action: z.object({
    id: z.string(),
    type: z.string(),
    description: z.string(),
    reversible: z.boolean().optional(),
    undoPayload: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(['completed', 'pending', 'failed', 'awaiting_confirmation', 'cancelled']),
  }),
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = undoSchema.parse(await request.json())
    const success = await undoAction(
      auth.tenantId,
      auth.userId,
      body.action as ActionTaken,
    )
    return NextResponse.json(apiSuccess({ undone: success }))
  } catch (err) {
    return handleRouteError(err)
  }
})

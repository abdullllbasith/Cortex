import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { voidEntry } from '@/lib/finance/journalEngine'

const voidSchema = z.object({
  reason: z.string().min(1).max(500),
})

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = voidSchema.parse(await request.json())
    const result = await voidEntry(id, auth.tenantId, body.reason, auth.userId)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

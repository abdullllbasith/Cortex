import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { setTenantSuspended } from '@/lib/admin/tenantAdminService'

const schema = z.object({
  suspended: z.boolean(),
  reason: z.string().min(1).max(500),
})

export const POST = requireAdminAuth(async (request, { params, auth }) => {
  try {
    const { id } = await params
    const body = schema.parse(await request.json())
    const result = await setTenantSuspended(id, body.suspended, body.reason, auth.email)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

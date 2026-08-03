import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { hardDeleteTenant } from '@/lib/admin/tenantAdminService'

const schema = z.object({
  confirmation: z.literal('DELETE'),
})

export const DELETE = requireAdminAuth(async (request, { params }) => {
  try {
    const { id } = await params
    const body = schema.parse(await request.json())
    if (body.confirmation !== 'DELETE') {
      return NextResponse.json(
        { success: false, error: { message: 'Confirmation required', code: 'INVALID_CONFIRMATION' } },
        { status: 400 },
      )
    }
    const result = await hardDeleteTenant(id)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { getTenantDetail } from '@/lib/admin/tenantAdminService'

export const GET = requireAdminAuth(async (_request, { params }) => {
  try {
    const { id } = await params
    const detail = await getTenantDetail(id)
    if (!detail) {
      return NextResponse.json(
        { success: false, error: { message: 'Tenant not found', code: 'NOT_FOUND' } },
        { status: 404 },
      )
    }
    return NextResponse.json(apiSuccess(detail))
  } catch (err) {
    return handleRouteError(err)
  }
})

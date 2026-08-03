import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import {
  getTenantExportData,
  triggerTenantExport,
} from '@/lib/admin/tenantAdminService'

export const POST = requireAdminAuth(async (_request, { params, auth }) => {
  try {
    const { id } = await params
    const result = await triggerTenantExport(id, auth.adminUserId)
    return NextResponse.json(apiSuccess(result), { status: 202 })
  } catch (err) {
    return handleRouteError(err)
  }
})

export const GET = requireAdminAuth(async (request, { params }) => {
  try {
    const { id } = await params
    const exportId = request.nextUrl.searchParams.get('id')
    if (!exportId) {
      return NextResponse.json(
        { success: false, error: { message: 'Export id required', code: 'VALIDATION_ERROR' } },
        { status: 400 },
      )
    }
    const data = await getTenantExportData(id, exportId)
    return NextResponse.json(data)
  } catch (err) {
    return handleRouteError(err)
  }
})

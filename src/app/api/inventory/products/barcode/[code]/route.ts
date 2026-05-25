import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { lookupByBarcode } from '@/lib/inventory/barcodeService'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { code } = await params
    const decoded = decodeURIComponent(code)
    const result = await lookupByBarcode(auth.tenantId, decoded)
    if (!result) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NOT_FOUND', message: 'No product or variant found for this barcode' } },
        { status: 404 },
      )
    }
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

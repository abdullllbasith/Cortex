import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { generateUniqueEAN13, renderEAN13Svg } from '@/lib/inventory/barcodeService'

export const POST = withTenantAuth(async (_request, { auth }) => {
  try {
    const barcode = await generateUniqueEAN13(auth.tenantId)
    const svg = await renderEAN13Svg(barcode)
    return NextResponse.json(apiSuccess({ barcode, svg }))
  } catch (err) {
    return handleRouteError(err)
  }
})

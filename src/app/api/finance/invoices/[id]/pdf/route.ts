import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { generateInvoicePDF } from '@/lib/finance/invoiceService'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const buffer = await generateInvoicePDF(id, auth.tenantId)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${id}.pdf"`,
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
})

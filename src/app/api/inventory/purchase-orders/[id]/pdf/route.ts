import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { generatePODocument, getPO } from '@/lib/inventory/purchaseOrderService'

export const GET = withTenantAuth(
  async (_request, { auth, params }) => {
    try {
      const { id } = await params
      await getPO(auth.tenantId, id)
      const buffer = await generatePODocument(id)
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="purchase-order-${id}.pdf"`,
        },
      })
    } catch (err) {
      return handleRouteError(err)
    }
  },
  { resourceType: 'purchase_order' },
)

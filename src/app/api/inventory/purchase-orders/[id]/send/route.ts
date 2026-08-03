import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { sendPO, getPO } from '@/lib/inventory/purchaseOrderService'

export const POST = withTenantAuth(
  async (_request, { auth, params }) => {
    try {
      const { id } = await params
      await sendPO(id, auth.userId)
      const po = await getPO(auth.tenantId, id)
      return NextResponse.json(apiSuccess(po))
    } catch (err) {
      return handleRouteError(err)
    }
  },
  { resourceType: 'purchase_order' },
)

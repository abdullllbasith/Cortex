import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { receiveGoodsSchema } from '@/lib/inventory/purchaseOrderSchemas'
import { getPO, receiveGoods } from '@/lib/inventory/purchaseOrderService'

export const POST = withTenantAuth(
  async (request, { auth, params }) => {
    try {
      const { id } = await params
      const body = receiveGoodsSchema.parse(await request.json())
      const result = await receiveGoods(id, body, auth.userId)
      const po = await getPO(auth.tenantId, id)
      return NextResponse.json(apiSuccess({ ...result, purchaseOrder: po }))
    } catch (err) {
      return handleRouteError(err)
    }
  },
  { resourceType: 'purchase_order' },
)

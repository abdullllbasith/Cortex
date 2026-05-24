import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { updatePOSchema } from '@/lib/inventory/purchaseOrderSchemas'
import { deletePO, getPO, updatePO } from '@/lib/inventory/purchaseOrderService'

export const GET = withTenantAuth(
  async (_request, { auth, params }) => {
    try {
      const { id } = await params
      const po = await getPO(auth.tenantId, id)
      return NextResponse.json(apiSuccess(po))
    } catch (err) {
      return handleRouteError(err)
    }
  },
  { resourceType: 'purchase_order' },
)

export const PUT = withTenantAuth(
  async (request, { auth, params }) => {
    try {
      const { id } = await params
      const body = updatePOSchema.parse(await request.json())
      await updatePO(auth.tenantId, id, body, auth.userId)
      const po = await getPO(auth.tenantId, id)
      return NextResponse.json(apiSuccess(po))
    } catch (err) {
      return handleRouteError(err)
    }
  },
  { resourceType: 'purchase_order' },
)

export const DELETE = withTenantAuth(
  async (_request, { auth, params }) => {
    try {
      const { id } = await params
      await deletePO(auth.tenantId, id, auth.userId)
      return NextResponse.json(apiSuccess({ deleted: true }))
    } catch (err) {
      return handleRouteError(err)
    }
  },
  { resourceType: 'purchase_order' },
)

import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { createPOSchema, poListQuerySchema } from '@/lib/inventory/purchaseOrderSchemas'
import { createPO, listPOs } from '@/lib/inventory/purchaseOrderService'

export const GET = withTenantAuth(
  async (request, { auth }) => {
    try {
      const query = poListQuerySchema.parse(parseQuery(request))
      const result = await listPOs(auth.tenantId, query)
      return NextResponse.json(
        apiSuccess(
          { items: result.data, stats: result.stats },
          paginatedMeta(result.page, result.limit, result.total),
        ),
      )
    } catch (err) {
      return handleRouteError(err)
    }
  },
  { resourceType: 'purchase_order' },
)

export const POST = withTenantAuth(
  async (request, { auth }) => {
    try {
      const body = createPOSchema.parse(await request.json())
      const record = await createPO(auth.tenantId, body, auth.userId)
      return NextResponse.json(apiSuccess(record), { status: 201 })
    } catch (err) {
      return handleRouteError(err)
    }
  },
  { resourceType: 'purchase_order' },
)

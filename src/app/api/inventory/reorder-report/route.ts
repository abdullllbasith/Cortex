import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getLowStockProducts } from '@/lib/inventory/inventoryDashboardService'
import { prisma } from '@/lib/db/prisma'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const items = await getLowStockProducts(auth.tenantId)

    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { tenantId: auth.tenantId, id: { in: productIds } },
      select: { id: true, supplierId: true, costPrice: true },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    const enriched = items.map((item) => {
      const product = productMap.get(item.productId)
      const urgency =
        item.onHand <= 0 ? 'critical' : item.onHand <= item.reorderPoint * 0.5 ? 'high' : 'medium'
      return {
        ...item,
        supplierId: product?.supplierId ?? null,
        estimatedLineCost: item.suggestedOrderQty * Number(product?.costPrice ?? 0),
        urgency,
        suggestedPO: {
          productId: item.productId,
          quantity: item.suggestedOrderQty,
          unitCost: Number(product?.costPrice ?? 0),
        },
      }
    })

    return NextResponse.json(
      apiSuccess({
        count: enriched.length,
        items: enriched.sort((a, b) => {
          const order = { critical: 0, high: 1, medium: 2 }
          return order[a.urgency as keyof typeof order] - order[b.urgency as keyof typeof order]
        }),
      }),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

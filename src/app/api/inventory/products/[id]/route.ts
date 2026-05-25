import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import {
  deleteCatalogProduct,
  getProductDetail,
  getProductAnalyticsSummary,
  getProductLedger,
  updateCatalogProduct,
} from '@/lib/inventory/inventoryCatalogService'
import { StockTransactionType } from '@prisma/client'

export const GET = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const tab = request.nextUrl.searchParams.get('tab')

    if (tab === 'ledger') {
      const query = parseQuery(request)
      const ledger = await getProductLedger(auth.tenantId, id, {
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 20,
        transactionType: query.transactionType as StockTransactionType | undefined,
      })
      return NextResponse.json(
        apiSuccess(ledger.entries, paginatedMeta(ledger.page, ledger.limit, ledger.total)),
      )
    }

    if (tab === 'analytics') {
      const analytics = await getProductAnalyticsSummary(auth.tenantId, id)
      if (!analytics) {
        return NextResponse.json(
          { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Product not found' } },
          { status: 404 },
        )
      }
      return NextResponse.json(apiSuccess(analytics))
    }

    const product = await getProductDetail(auth.tenantId, id, { includeAnalytics: false })
    if (!product) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Product not found' } },
        { status: 404 },
      )
    }
    return NextResponse.json(apiSuccess(product))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = z.record(z.string(), z.unknown()).parse(await request.json())
    const product = await updateCatalogProduct(auth.tenantId, id, body, auth.userId)
    const detail = await getProductDetail(auth.tenantId, id)
    return NextResponse.json(apiSuccess(detail ?? product))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const result = await deleteCatalogProduct(auth.tenantId, id, auth.userId)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

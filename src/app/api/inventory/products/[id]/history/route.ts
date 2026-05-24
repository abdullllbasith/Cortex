import { NextResponse } from 'next/server'
import { z } from 'zod'
import { StockTransactionType } from '@prisma/client'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { getProductLedger } from '@/lib/inventory/inventoryCatalogService'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  transactionType: z.nativeEnum(StockTransactionType).optional(),
  period: z.enum(['7d', '30d', '90d', 'all']).optional(),
})

export const GET = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const query = querySchema.parse(parseQuery(request))

    const ledger = await getProductLedger(auth.tenantId, id, {
      page: query.page,
      limit: query.limit,
      transactionType: query.transactionType,
    })

    let entries = ledger.entries
    if (query.period && query.period !== 'all') {
      const days = query.period === '7d' ? 7 : query.period === '30d' ? 30 : 90
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      entries = entries.filter((e) => new Date(e.createdAt) >= cutoff)
    }

    return NextResponse.json(
      apiSuccess(entries, paginatedMeta(ledger.page, ledger.limit, ledger.total)),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

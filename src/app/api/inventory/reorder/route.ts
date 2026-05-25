import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { privateCacheHeaders } from '@/lib/http/cacheHeaders'
import {
  createAllDraftPOs,
  createDraftPO,
  dismissSuggestion,
  dismissSupplierGroup,
  generateReorderSuggestions,
  getReorderSuggestionCount,
  type ReorderUrgency,
} from '@/lib/inventory/reorderService'

const querySchema = z.object({
  urgency: z.enum(['critical', 'warning', 'all']).default('all'),
  countOnly: z.coerce.boolean().optional(),
})

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = querySchema.parse(parseQuery(request))

    if (query.countOnly) {
      const { count, lastCheckedAt } = await getReorderSuggestionCount(auth.tenantId)
      return NextResponse.json(apiSuccess({ count, lastCheckedAt }), {
        headers: privateCacheHeaders(60, 180),
      })
    }

    const result = await generateReorderSuggestions(auth.tenantId, query.urgency as ReorderUrgency)

    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

const dismissSchema = z.object({
  productId: z.string().min(1),
  days: z.number().int().min(1).max(30).default(7),
})

const createPoSchema = z.object({
  supplierId: z.string().min(1),
  productIds: z.array(z.string()).optional(),
})

const createAllSchema = z.object({
  urgency: z.enum(['critical', 'warning', 'all']).default('all'),
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = await request.json()
    const action = String(body.action ?? 'create_po')

    if (action === 'refresh') {
      const urgency = (body.urgency as ReorderUrgency) ?? 'all'
      const result = await generateReorderSuggestions(auth.tenantId, urgency)
      return NextResponse.json(apiSuccess(result))
    }

    if (action === 'dismiss') {
      const input = dismissSchema.parse(body)
      await dismissSuggestion(auth.tenantId, input.productId, input.days)
      return NextResponse.json(apiSuccess({ dismissed: true }))
    }

    if (action === 'dismiss_group') {
      const productIds = z.array(z.string()).parse(body.productIds)
      const days = z.number().int().min(1).max(30).default(7).parse(body.days ?? 7)
      await dismissSupplierGroup(auth.tenantId, productIds, days)
      return NextResponse.json(apiSuccess({ dismissed: productIds.length }))
    }

    if (action === 'create_all') {
      const input = createAllSchema.parse(body)
      const { groups } = await generateReorderSuggestions(auth.tenantId, input.urgency as ReorderUrgency)
      const pos = await createAllDraftPOs(auth.tenantId, groups, auth.userId)
      return NextResponse.json(apiSuccess({ purchaseOrders: pos }))
    }

    const input = createPoSchema.parse(body)
    const { groups } = await generateReorderSuggestions(auth.tenantId, 'all')
    const group = groups.find((g) => g.supplierId === input.supplierId)
    if (!group) throw new Error('Supplier group not found')

    const suggestions = input.productIds?.length
      ? group.suggestions.filter((s) => input.productIds!.includes(s.productId))
      : group.suggestions

    const po = await createDraftPO(auth.tenantId, input.supplierId, suggestions, auth.userId)
    return NextResponse.json(apiSuccess(po), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

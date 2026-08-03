import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { activitySchema } from '@/lib/crm/crmSchemas'
import { createActivity, listActivities } from '@/lib/crm/activityService'
import { z } from 'zod'

const activityListQuerySchema = z.object({
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  companyId: z.string().optional(),
  type: z.string().optional(),
  isCompleted: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = activityListQuerySchema.parse(parseQuery(request))
    const result = await listActivities(auth.tenantId, query)
    return NextResponse.json(
      apiSuccess({ items: result.items }, paginatedMeta(result.page, result.limit, result.total)),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = activitySchema.parse(await request.json())
    const record = await createActivity(auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

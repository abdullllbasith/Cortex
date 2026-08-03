import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { TenantPlan } from '@prisma/client'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { listTenants } from '@/lib/admin/tenantAdminService'
import type { TenantAdminStatus } from '@/lib/admin/tenantSettingsAdmin'

const querySchema = z.object({
  search: z.string().optional(),
  plan: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
  status: z.enum(['active', 'trial', 'suspended', 'churned']).optional(),
  sort: z.enum(['mrr', 'createdAt', 'activity']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const GET = requireAdminAuth(async (request) => {
  try {
    const sp = request.nextUrl.searchParams
    const params = querySchema.parse({
      search: sp.get('search') ?? undefined,
      plan: sp.get('plan') ?? undefined,
      status: sp.get('status') ?? undefined,
      sort: sp.get('sort') ?? undefined,
      order: sp.get('order') ?? undefined,
      page: sp.get('page') ?? undefined,
      limit: sp.get('limit') ?? undefined,
    })

    const result = await listTenants({
      search: params.search,
      plan: params.plan as TenantPlan | undefined,
      status: params.status as TenantAdminStatus | undefined,
      sort: params.sort,
      order: params.order,
      page: params.page,
      limit: params.limit,
    })

    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

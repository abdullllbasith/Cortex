import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { TenantPlan } from '@prisma/client'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { overrideTenantPlan } from '@/lib/admin/tenantAdminService'

const schema = z.object({
  plan: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
  note: z.string().min(1).max(1000),
})

export const PUT = requireAdminAuth(async (request, { params, auth }) => {
  try {
    const { id } = await params
    const body = schema.parse(await request.json())
    const result = await overrideTenantPlan(
      id,
      body.plan as TenantPlan,
      body.note,
      auth.email,
    )
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

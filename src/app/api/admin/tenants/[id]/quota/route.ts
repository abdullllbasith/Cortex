import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { overrideTenantQuotas } from '@/lib/admin/tenantAdminService'

const schema = z.object({
  aiCalls: z.number().int().positive().optional(),
  workflows: z.number().int().positive().optional(),
  storageGb: z.number().positive().optional(),
  apiCalls: z.number().int().positive().optional(),
  teamMembers: z.number().int().positive().optional(),
})

export const PUT = requireAdminAuth(async (request, { params, auth }) => {
  try {
    const { id } = await params
    const body = schema.parse(await request.json())
    const result = await overrideTenantQuotas(id, body, auth.email)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

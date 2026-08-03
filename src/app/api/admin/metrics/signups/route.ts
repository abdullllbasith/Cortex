import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { getSignupTrend } from '@/lib/admin/platformMetrics'

const querySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30),
})

export const GET = requireAdminAuth(async (request) => {
  try {
    const params = querySchema.parse({
      days: request.nextUrl.searchParams.get('days') ?? 30,
    })

    const trend = await getSignupTrend(params.days)

    return NextResponse.json(
      apiSuccess({
        days: params.days,
        trend,
        total: trend.reduce((sum, p) => sum + p.signups, 0),
      }),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

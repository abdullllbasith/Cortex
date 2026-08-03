import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { getMRRTrend } from '@/lib/admin/platformMetrics'

const querySchema = z.object({
  days: z.coerce.number().refine((d) => d === 30 || d === 90 || d === 365, {
    message: 'days must be 30, 90, or 365',
  }).default(30),
})

export const GET = requireAdminAuth(async (request) => {
  try {
    const params = querySchema.parse({
      days: request.nextUrl.searchParams.get('days') ?? 30,
    })

    const trend = await getMRRTrend(params.days as 30 | 90 | 365)

    return NextResponse.json(
      apiSuccess({
        days: params.days,
        trend,
      }),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

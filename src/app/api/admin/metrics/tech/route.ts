import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { getTechMetrics } from '@/lib/admin/platformMetrics'

export const GET = requireAdminAuth(async () => {
  try {
    const metrics = await getTechMetrics()
    return NextResponse.json(apiSuccess(metrics))
  } catch (err) {
    return handleRouteError(err)
  }
})

import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { attendanceCreateSchema, attendanceListSchema } from '@/lib/hr/hrSchemas'
import { listAttendance, recordAttendance } from '@/lib/hr/leaveService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = attendanceListSchema.parse(parseQuery(request))
    const items = await listAttendance(auth.tenantId, query)
    return NextResponse.json(apiSuccess(items))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = attendanceCreateSchema.parse(await request.json())
    const record = await recordAttendance(auth.tenantId, body)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { leaveTypeSchema } from '@/lib/hr/hrSchemas'
import { createLeaveType, listLeaveTypes, updateLeaveType } from '@/lib/hr/leaveService'

const updateSchema = leaveTypeSchema.partial()

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const items = await listLeaveTypes(auth.tenantId)
    return NextResponse.json(apiSuccess(items))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = leaveTypeSchema.parse(await request.json())
    const record = await createLeaveType(auth.tenantId, body)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth }) => {
  try {
    const body = z.object({ id: z.string().min(1) }).merge(updateSchema).parse(await request.json())
    const record = await updateLeaveType(auth.tenantId, body.id, body)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

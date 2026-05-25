import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { departmentSchema } from '@/lib/hr/hrSchemas'
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  updateDepartment,
} from '@/lib/hr/leaveService'

const updateSchema = departmentSchema.partial()

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const items = await listDepartments(auth.tenantId)
    return NextResponse.json(apiSuccess(items))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = departmentSchema.parse(await request.json())
    const record = await createDepartment(auth.tenantId, body)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth }) => {
  try {
    const body = z.object({ id: z.string().min(1) }).merge(updateSchema).parse(await request.json())
    const record = await updateDepartment(auth.tenantId, body.id, body)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = withTenantAuth(async (request, { auth }) => {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'Department id is required' } },
        { status: 400 },
      )
    }
    const result = await deleteDepartment(auth.tenantId, id)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { designationSchema } from '@/lib/hr/hrSchemas'
import {
  createDesignation,
  deleteDesignation,
  listDesignations,
  updateDesignation,
} from '@/lib/hr/leaveService'

const updateSchema = designationSchema.partial()

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = parseQuery(request)
    const departmentId = query.departmentId as string | undefined
    const items = await listDesignations(auth.tenantId, departmentId)
    return NextResponse.json(apiSuccess(items))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = designationSchema.parse(await request.json())
    const record = await createDesignation(auth.tenantId, body)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth }) => {
  try {
    const body = z.object({ id: z.string().min(1) }).merge(updateSchema).parse(await request.json())
    const record = await updateDesignation(auth.tenantId, body.id, body)
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
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'Designation id is required' } },
        { status: 400 },
      )
    }
    const result = await deleteDesignation(auth.tenantId, id)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { supplierUpdateSchema } from '@/lib/inventory/supplierSchemas'
import { deleteSupplier, getSupplier, updateSupplier } from '@/lib/inventory/supplierService'

const getQuerySchema = z.object({
  unlockPassword: z.string().optional(),
})

export const GET = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const query = getQuerySchema.parse(parseQuery(request))
    const record = await getSupplier(auth.tenantId, id, {
      unlockPassword: query.unlockPassword,
      actorId: auth.userId,
    })
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = supplierUpdateSchema.parse(await request.json())
    const record = await updateSupplier(auth.tenantId, id, body)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const result = await deleteSupplier(auth.tenantId, id)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

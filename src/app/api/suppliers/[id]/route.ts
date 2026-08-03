import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { knowledgeRepository } from '@/lib/knowledge/knowledgeRepository'
import { apiSuccess } from '@/lib/knowledge/response'
import { supplierUpdateSchema } from '@/lib/knowledge/schemas'

export const GET = withTenantAuth(async (_request, { params, auth }) => {
  try {
    const { id } = await params
    const record = await knowledgeRepository.getSupplier(auth.tenantId, id)
    if (!record) return NextResponse.json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Supplier not found' } }, { status: 404 })
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { params, auth }) => {
  try {
    const { id } = await params
    const body = supplierUpdateSchema.parse(await request.json())
    const record = await knowledgeRepository.updateSupplier(auth.tenantId, id, body, auth.userId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = withTenantAuth(async (_request, { params, auth }) => {
  try {
    const { id } = await params
    await knowledgeRepository.deleteSupplier(auth.tenantId, id, auth.userId)
    return NextResponse.json(apiSuccess({ deleted: true }))
  } catch (err) {
    return handleRouteError(err)
  }
})

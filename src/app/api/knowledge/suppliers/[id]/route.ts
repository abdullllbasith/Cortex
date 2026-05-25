import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import {
  getKnowledgeSupplier,
  updateKnowledgeSupplier,
} from '@/lib/knowledge/knowledgeProductSupplierService'
import { knowledgeRepository } from '@/lib/knowledge/knowledgeRepository'

export const GET = withTenantAuth(async (_request, { params, auth }) => {
  try {
    const { id } = await params
    const supplier = await getKnowledgeSupplier(auth.tenantId, id)
    if (!supplier) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Supplier not found' } },
        { status: 404 },
      )
    }
    return NextResponse.json(apiSuccess(supplier))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { params, auth }) => {
  try {
    const { id } = await params
    const body = z.record(z.string(), z.unknown()).parse(await request.json())
    const supplier = await updateKnowledgeSupplier(auth.tenantId, id, body, auth.userId)
    return NextResponse.json(apiSuccess(supplier))
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

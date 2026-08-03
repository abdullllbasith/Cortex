import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import {
  getKnowledgeProduct,
  updateKnowledgeProduct,
} from '@/lib/knowledge/knowledgeProductSupplierService'
import { prisma } from '@/lib/db/prisma'

export const GET = withTenantAuth(async (_request, { params, auth }) => {
  try {
    const { id } = await params
    const product = await getKnowledgeProduct(auth.tenantId, id)
    if (!product) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Product not found' } },
        { status: 404 },
      )
    }
    return NextResponse.json(apiSuccess(product))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { params, auth }) => {
  try {
    const { id } = await params
    const body = z.record(z.string(), z.unknown()).parse(await request.json())
    const product = await updateKnowledgeProduct(auth.tenantId, id, body, auth.userId)
    return NextResponse.json(apiSuccess(product))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = withTenantAuth(async (_request, { params, auth }) => {
  try {
    const { id } = await params
    await prisma.product.deleteMany({ where: { id, tenantId: auth.tenantId } })
    return NextResponse.json(apiSuccess({ deleted: true }))
  } catch (err) {
    return handleRouteError(err)
  }
})

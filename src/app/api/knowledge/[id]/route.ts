import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { knowledgeRepository } from '@/lib/knowledge/knowledgeRepository'
import { apiSuccess } from '@/lib/knowledge/response'
import { knowledgeUpdateSchema } from '@/lib/knowledge/schemas'

export const GET = withTenantAuth(async (_request, { params, auth }) => {
  try {
    const { id } = await params
    const record = await knowledgeRepository.getKnowledge(auth.tenantId, id)
    if (!record) return NextResponse.json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Document not found' } }, { status: 404 })
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { params, auth }) => {
  try {
    const { id } = await params
    const body = knowledgeUpdateSchema.parse(await request.json())
    const record = await knowledgeRepository.updateKnowledge(auth.tenantId, id, body, auth.userId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = withTenantAuth(async (_request, { params, auth }) => {
  try {
    const { id } = await params
    await knowledgeRepository.deleteKnowledge(auth.tenantId, id, auth.userId)
    return NextResponse.json(apiSuccess({ deleted: true }))
  } catch (err) {
    return handleRouteError(err)
  }
})

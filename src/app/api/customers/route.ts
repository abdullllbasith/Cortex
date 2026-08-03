import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { knowledgeRepository } from '@/lib/knowledge/knowledgeRepository'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { customerCreateSchema, paginationSchema } from '@/lib/knowledge/schemas'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = paginationSchema.parse(parseQuery(request))
    const { data, total } = await knowledgeRepository.listCustomers(auth.tenantId, query)
    return NextResponse.json(apiSuccess(data, paginatedMeta(query.page, query.limit, total)))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = customerCreateSchema.parse(await request.json())
    const record = await knowledgeRepository.createCustomer(auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

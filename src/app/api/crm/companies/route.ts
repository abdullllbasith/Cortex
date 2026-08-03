import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { companySchema } from '@/lib/crm/crmSchemas'
import { createCompany, deleteCompany, listCompanies, updateCompany } from '@/lib/crm/companyService'
import { z } from 'zod'

const companyUpdateSchema = companySchema.extend({ id: z.string().min(1) })

const companyQuerySchema = z.object({
  search: z.string().optional(),
  id: z.string().optional(),
})

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = companyQuerySchema.parse(parseQuery(request))
    const items = await listCompanies(auth.tenantId, query.search)
    return NextResponse.json(apiSuccess({ items }))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = companySchema.parse(await request.json())
    const record = await createCompany(auth.tenantId, body)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth }) => {
  try {
    const body = companyUpdateSchema.parse(await request.json())
    const record = await updateCompany(auth.tenantId, body.id, body)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = withTenantAuth(async (request, { auth }) => {
  try {
    const query = companyQuerySchema.parse(parseQuery(request))
    if (!query.id) {
      return NextResponse.json({ error: { message: 'id query parameter is required' } }, { status: 400 })
    }
    const result = await deleteCompany(auth.tenantId, query.id)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

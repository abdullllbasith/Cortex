import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { taxRateCreateSchema, taxRateUpdateSchema } from '@/lib/finance/financeSchemas'
import { createTaxRate, listTaxRates, updateTaxRate } from '@/lib/finance/chartOfAccountsService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const items = await listTaxRates(auth.tenantId)
    return NextResponse.json(apiSuccess({ items }))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = taxRateCreateSchema.parse(await request.json())
    const record = await createTaxRate(auth.tenantId, body)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth }) => {
  try {
    const body = taxRateUpdateSchema.parse(await request.json())
    const { id, ...updates } = body
    const record = await updateTaxRate(auth.tenantId, id, updates)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

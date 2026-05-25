import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { activitySchema, contactActivityQuerySchema } from '@/lib/crm/crmSchemas'
import { createContactActivity, listContactActivities } from '@/lib/crm/contactService'

export const GET = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const query = contactActivityQuerySchema.parse(parseQuery(request))
    const items = await listContactActivities(auth.tenantId, id, query)
    return NextResponse.json(apiSuccess({ items }))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = activitySchema.parse(await request.json())
    const record = await createContactActivity(auth.tenantId, id, body, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

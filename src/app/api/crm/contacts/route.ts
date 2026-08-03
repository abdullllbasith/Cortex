import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { contactCreateSchema, contactListQuerySchema } from '@/lib/crm/crmSchemas'
import { createContact, findDuplicates, listContacts } from '@/lib/crm/contactService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = contactListQuerySchema.parse(parseQuery(request))
    const url = new URL(request.url)
    if (url.searchParams.get('duplicates') === 'true') {
      const dupes = await findDuplicates(auth.tenantId)
      return NextResponse.json(apiSuccess(dupes))
    }
    const result = await listContacts(auth.tenantId, {
      ...query,
      userId: auth.userId,
      semantic: query.semantic ?? Boolean(query.search),
    })
    return NextResponse.json(
      apiSuccess(
        { items: result.items },
        paginatedMeta(result.page, result.limit, result.total),
      ),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = contactCreateSchema.parse(await request.json())
    const { contact, warnings } = await createContact(auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess({ contact, warnings }), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { contactUpdateSchema } from '@/lib/crm/crmSchemas'
import { deleteContact, getContact, updateContact } from '@/lib/crm/contactService'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const record = await getContact(auth.tenantId, id)
    if (!record) {
      return NextResponse.json({ error: { message: 'Contact not found' } }, { status: 404 })
    }
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = contactUpdateSchema.parse(await request.json())
    const record = await updateContact(auth.tenantId, id, body)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const result = await deleteContact(auth.tenantId, id)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

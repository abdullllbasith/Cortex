import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { supplierContactSchema } from '@/lib/inventory/supplierSchemas'
import {
  createSupplierContact,
  deleteSupplierContact,
  listSupplierContacts,
} from '@/lib/inventory/supplierService'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const contacts = await listSupplierContacts(auth.tenantId, id)
    return NextResponse.json(apiSuccess(contacts))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = supplierContactSchema.parse(await request.json())
    const contact = await createSupplierContact(auth.tenantId, id, body)
    return NextResponse.json(apiSuccess(contact), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const query = z.object({ contactId: z.string().min(1) }).parse(parseQuery(request))
    const result = await deleteSupplierContact(auth.tenantId, id, query.contactId)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

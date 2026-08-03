import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { findDuplicates } from '@/lib/crm/contactService'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const dupes = await findDuplicates(auth.tenantId)
    return NextResponse.json(apiSuccess(dupes))
  } catch (err) {
    return handleRouteError(err)
  }
})

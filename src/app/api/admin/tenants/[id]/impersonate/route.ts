import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import {
  createImpersonationToken,
  setImpersonationCookie,
} from '@/lib/admin/impersonationService'

export const POST = requireAdminAuth(async (_request, { params, auth }) => {
  try {
    const { id } = await params
    const { token, session } = await createImpersonationToken(
      auth.adminUserId,
      auth.email,
      id,
    )

    const response = NextResponse.json(
      apiSuccess({
        token,
        session,
        redirectUrl: '/dashboard',
      }),
    )
    setImpersonationCookie(response, token)
    return response
  } catch (err) {
    return handleRouteError(err)
  }
})

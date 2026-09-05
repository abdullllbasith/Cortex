import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { noStoreHeaders } from '@/lib/http/cacheHeaders'
import { prisma } from '@/lib/db/prisma'

/** Lightweight MFA status for Settings → Security (never cache). */
export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: auth.userId, tenantId: auth.tenantId, isActive: true },
      select: { mfaEnabled: true, mfaSecretEnc: true, email: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'User not found' } },
        { status: 404, headers: noStoreHeaders() },
      )
    }

    return NextResponse.json(
      apiSuccess({
        mfaEnabled: Boolean(user.mfaEnabled),
        /** Secret present but not confirmed — mid-setup */
        setupInProgress: Boolean(user.mfaSecretEnc) && !user.mfaEnabled,
        email: user.email,
      }),
      { headers: noStoreHeaders() },
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

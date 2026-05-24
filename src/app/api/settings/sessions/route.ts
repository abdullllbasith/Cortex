import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, decodeJwt } from 'jose'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import {
  listUserSessions,
  revokeOtherSessions,
  revokeSessionById,
} from '@/lib/settings/profileService'

async function getSessionIdFromRequest(request: NextRequest): Promise<string | undefined> {
  const auth = request.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token || token.startsWith('sk_saios_')) return undefined

  const secret = process.env.JWT_SECRET
  if (!secret) return undefined

  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(secret))
    return verified.payload.sessionId as string | undefined
  } catch {
    if (process.env.AUTH_DEV_MODE === 'true') {
      const payload = decodeJwt(token)
      return payload.sessionId as string | undefined
    }
    return undefined
  }
}

export const GET = requirePermission(PERMISSIONS.KNOWLEDGE_READ)(
  async (request, { auth }) => {
    try {
      const currentSessionId = await getSessionIdFromRequest(request)
      const sessions = await listUserSessions(auth.userId, auth.tenantId, currentSessionId)
      return NextResponse.json(apiSuccess({ sessions }))
    } catch (err) {
      return handleRouteError(err)
    }
  },
)

export const DELETE = requirePermission(PERMISSIONS.KNOWLEDGE_READ)(
  async (request, { auth }) => {
    try {
      const sessionId = request.nextUrl.searchParams.get('id')
      const revokeAll = request.nextUrl.searchParams.get('all') === 'true'
      const currentSessionId = await getSessionIdFromRequest(request)

      if (revokeAll) {
        const count = await revokeOtherSessions(auth.userId, auth.tenantId, currentSessionId)
        return NextResponse.json(apiSuccess({ revoked: count }))
      }

      if (!sessionId) {
        return NextResponse.json(
          { success: false, error: { message: 'Session id required', code: 'VALIDATION_ERROR' } },
          { status: 400 },
        )
      }

      if (sessionId === currentSessionId) {
        return NextResponse.json(
          { success: false, error: { message: 'Cannot revoke current session', code: 'FORBIDDEN' } },
          { status: 403 },
        )
      }

      const revoked = await revokeSessionById(sessionId, auth.userId, auth.tenantId)
      return NextResponse.json(apiSuccess({ revoked }))
    } catch (err) {
      return handleRouteError(err)
    }
  },
)

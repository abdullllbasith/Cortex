import { NextRequest, NextResponse } from 'next/server'
import { validateRefreshToken, issueSession, revokeSession } from '@/lib/auth/sessionService'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { setRefreshCookie } from '@/lib/auth/sessionCookies'

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('saios_refresh')?.value
    if (!refreshToken) {
      return NextResponse.json({ success: false, error: { message: 'No refresh token' } }, { status: 401 })
    }

    const session = await validateRefreshToken(refreshToken)
    if (!session || !session.user.isActive) {
      return NextResponse.json({ success: false, error: { message: 'Session expired' } }, { status: 401 })
    }

    await revokeSession(refreshToken)
    const meta = {
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
      userAgent: request.headers.get('user-agent'),
    }

    const rememberMe = session.expiresAt.getTime() - session.createdAt.getTime() > 2 * 24 * 60 * 60 * 1000
    const issued = await issueSession(session.userId, meta, { rememberMe })
    const response = NextResponse.json({
      success: true,
      data: {
        accessToken: issued.accessToken,
        permissions: issued.permissions,
      },
    })
    setRefreshCookie(response, issued.refreshToken, rememberMe)
    return response
  } catch (err) {
    console.error('[auth/refresh]', err)
    return NextResponse.json({ success: false, error: { message: 'Token refresh failed' } }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!auth) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
    }
    const payload = await verifyAccessToken(auth)
    return NextResponse.json({ success: true, data: payload })
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Invalid token' } }, { status: 401 })
  }
}

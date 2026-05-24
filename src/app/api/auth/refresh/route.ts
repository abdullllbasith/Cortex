import { NextRequest, NextResponse } from 'next/server'
import { validateRefreshToken, issueSession, revokeSession } from '@/lib/auth/sessionService'
import { REFRESH_COOKIE } from '@/lib/auth/jwt'
import { verifyAccessToken } from '@/lib/auth/jwt'

function setRefreshCookie(response: NextResponse, token: string) {
  response.cookies.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  })
}

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value
  if (!refreshToken) {
    return NextResponse.json({ success: false, error: { message: 'No refresh token' } }, { status: 401 })
  }

  const session = await validateRefreshToken(refreshToken)
  if (!session || !session.user.isActive) {
    return NextResponse.json({ success: false, error: { message: 'Session expired' } }, { status: 401 })
  }

  // Rotate refresh token
  await revokeSession(refreshToken)
  const meta = {
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: request.headers.get('user-agent'),
  }

  const issued = await issueSession(session.userId, meta)
  const response = NextResponse.json({
    success: true,
    data: {
      accessToken: issued.accessToken,
      permissions: issued.permissions,
    },
  })
  setRefreshCookie(response, issued.refreshToken)
  return response
}

/** Optional: validate current access token without refresh */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth) {
    return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
  }
  try {
    const payload = await verifyAccessToken(auth)
    return NextResponse.json({ success: true, data: payload })
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Invalid token' } }, { status: 401 })
  }
}

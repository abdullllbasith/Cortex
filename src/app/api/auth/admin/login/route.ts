import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { applyRateLimit } from '@/lib/security/rateLimiter'
import {
  authenticatePlatformAdmin,
  issueAdminSession,
  isPlatformAdminLoginConfigured,
} from '@/lib/auth/adminSessionService'
import { ADMIN_ACCESS_TTL, ADMIN_TOKEN_COOKIE } from '@/lib/auth/adminJwt'
import { logAdminAction, getClientIp } from '@/middleware/adminAuth'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, 'auth')
  if (blocked) return blocked

  if (!isPlatformAdminLoginConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            'Platform admin login is not configured. Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD in .env.',
          code: 'ADMIN_LOGIN_NOT_CONFIGURED',
        },
      },
      { status: 503 },
    )
  }

  try {
    const body = bodySchema.parse(await request.json())
    const auth = await authenticatePlatformAdmin(body.email, body.password)

    if (!auth) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid admin credentials', code: 'INVALID_CREDENTIALS' } },
        { status: 401 },
      )
    }

    const accessToken = await issueAdminSession(auth)

    await logAdminAction(auth.adminUserId, 'admin.login', {
      ipAddress: getClientIp(request),
      details: { email: auth.email },
    })

    const response = NextResponse.json({
      success: true,
      data: {
        admin: {
          id: auth.adminUserId,
          email: auth.email,
          name: auth.fullName,
          role: auth.role,
        },
        accessToken,
      },
    })

    response.cookies.set(ADMIN_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ADMIN_ACCESS_TTL,
    })

    return response
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid request', code: 'VALIDATION_ERROR' } },
        { status: 400 },
      )
    }
    console.error('[auth/admin/login]', err)
    return NextResponse.json(
      { success: false, error: { message: 'Admin login failed', code: 'INTERNAL_ERROR' } },
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { applyRateLimit } from '@/lib/security/rateLimiter'
import { AccountNotFoundError, requestPasswordReset } from '@/lib/auth/passwordResetService'
import { forgotPasswordSchema } from '@/lib/auth/schemas'

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, 'auth')
  if (blocked) return blocked

  try {
    const body = forgotPasswordSchema.parse(await request.json())
    await requestPasswordReset(body.email)

    return NextResponse.json({
      success: true,
      message: 'We sent a password reset link to your email. It may take a few minutes to arrive.',
    })
  } catch (err) {
    console.error('[auth/forgot-password]', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { message: 'Invalid email' } }, { status: 400 })
    }
    if (err instanceof AccountNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: err.code, message: err.message },
        },
        { status: 404 },
      )
    }
    const message = err instanceof Error ? err.message : 'Failed to send reset email'
    return NextResponse.json({ success: false, error: { message } }, { status: 503 })
  }
}

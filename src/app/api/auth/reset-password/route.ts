import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { applyRateLimit } from '@/lib/security/rateLimiter'
import { completePasswordReset } from '@/lib/auth/passwordResetService'

const bodySchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    token_hash: z.string().min(1),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, 'auth')
  if (blocked) return blocked

  try {
    const body = bodySchema.parse(await request.json())
    await completePasswordReset(body.token_hash, body.password)

    return NextResponse.json({ success: true, message: 'Password updated' })
  } catch (err) {
    console.error('[auth/reset-password]', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { message: 'Invalid request' } }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Password reset failed'
    return NextResponse.json({ success: false, error: { message } }, { status: 400 })
  }
}

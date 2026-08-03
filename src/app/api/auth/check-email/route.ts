import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isEmailRegistered, normalizeEmail } from '@/lib/auth/emailAvailability'
import { applyRateLimit } from '@/lib/security/rateLimiter'

const querySchema = z.object({
  email: z.string().email(),
})

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, 'auth')
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({ email: searchParams.get('email') ?? '' })

  if (!parsed.success) {
    return NextResponse.json(
      { available: false, message: 'Enter a valid email address' },
      { status: 400 },
    )
  }

  const email = normalizeEmail(parsed.data.email)
  const registered = await isEmailRegistered(email)

  return NextResponse.json({
    available: !registered,
    email,
    message: registered
      ? 'An account already exists for this email. Sign in instead.'
      : undefined,
  })
}

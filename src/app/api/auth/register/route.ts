import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { createSupabaseAdminClient } from '@/lib/auth/supabaseServer'
import { issueSession } from '@/lib/auth/sessionService'
import { REFRESH_COOKIE } from '@/lib/auth/jwt'
import { extractRequestMeta } from '@/lib/audit/auditLogger'
import { recordLoginSuccess } from '@/lib/audit/securityMonitor'
import { applyRateLimit } from '@/lib/security/rateLimiter'
import { registerSchema } from '@/lib/auth/schemas'
import { sanitizeInput } from '@/lib/security/sanitizer'
import { TenantPlan } from '@prisma/client'

const PLAN_MAP: Record<string, TenantPlan> = {
  starter: 'STARTER',
  professional: 'PROFESSIONAL',
  enterprise: 'ENTERPRISE',
}

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
  const blocked = await applyRateLimit(request, 'auth')
  if (blocked) return blocked

  try {
    const body = sanitizeInput(registerSchema.parse(await request.json()))
    const email = body.email.toLowerCase()
    const fullName = `${body.firstName} ${body.lastName}`.trim()

    const existingSlug = await prisma.tenant.findUnique({ where: { slug: body.slug } })
    if (existingSlug) {
      return NextResponse.json({ success: false, error: { message: 'Slug already taken' } }, { status: 409 })
    }

    const admin = createSupabaseAdminClient()
    let supabaseId: string

    if (admin) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          tenant_slug: body.slug,
          onboarding_complete: false,
        },
      })
      if (error || !data.user) {
        return NextResponse.json({ success: false, error: { message: error?.message ?? 'Auth failed' } }, { status: 400 })
      }
      supabaseId = data.user.id
    } else if (process.env.AUTH_DEV_MODE === 'true') {
      supabaseId = `dev-${email.replace(/[^a-z0-9]/gi, '-')}`
    } else {
      return NextResponse.json({ success: false, error: { message: 'Supabase not configured' } }, { status: 503 })
    }

    const tenant = await prisma.tenant.create({
      data: {
        name: body.companyName,
        slug: body.slug,
        plan: PLAN_MAP[body.plan] ?? 'STARTER',
      },
    })

    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        supabaseId,
        email,
        fullName,
        role: 'OWNER',
      },
    })

    const meta = extractRequestMeta(request)
    const session = await issueSession(user.id, meta)

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.fullName,
          role: session.user.role.toLowerCase(),
        },
        tenant: session.tenant,
        permissions: session.permissions,
        accessToken: session.accessToken,
        isNewUser: true,
      },
    }, { status: 201 })

    setRefreshCookie(response, session.refreshToken)
    await recordLoginSuccess(tenant.id, user.id, meta.ipAddress)
    return response
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { message: 'Validation failed', issues: err.issues } }, { status: 400 })
    }
    console.error('[auth/register]', err)
    return NextResponse.json({ success: false, error: { message: 'Registration failed' } }, { status: 500 })
  }
}

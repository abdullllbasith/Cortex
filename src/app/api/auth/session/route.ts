import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/auth/supabaseServer'
import { findOrLinkUserBySupabase, issueSession } from '@/lib/auth/sessionService'
import { resolveCanonicalUserByEmail } from '@/lib/auth/resolveCanonicalUser'
import { extractRequestMeta } from '@/lib/audit/auditLogger'
import { recordLoginSuccess, recordLoginFailed } from '@/lib/audit/securityMonitor'
import { applyRateLimit } from '@/lib/security/rateLimiter'
import { prisma } from '@/lib/db/prisma'
import {
  setRefreshCookie,
  setMfaPendingCookie,
} from '@/lib/auth/sessionCookies'

const bodySchema = z.object({
  email: z.string().email().optional(),
  password: z.string().optional(),
  supabaseAccessToken: z.string().optional(),
  rememberMe: z.boolean().optional().default(true),
})

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, 'auth')
  if (blocked) return blocked

  const meta = extractRequestMeta(request)

  try {
    const body = bodySchema.parse(await request.json())
    let supabaseUserId: string | null = null

    const supabase = await createSupabaseServerClient()

    if (body.supabaseAccessToken && supabase) {
      const { data, error } = await supabase.auth.getUser(body.supabaseAccessToken)
      if (error || !data.user) {
        return NextResponse.json({ success: false, error: { message: 'Invalid token' } }, { status: 401 })
      }
      supabaseUserId = data.user.id

      const user = await findOrLinkUserBySupabase(data.user.id, data.user.email ?? '')
      if (!user || !user.isActive) {
        return NextResponse.json({ success: false, error: { message: 'User not provisioned' } }, { status: 403 })
      }

      const mfaRequired = user.mfaEnabled
      const session = await issueSession(user.id, meta, {
        mfaPending: mfaRequired,
        rememberMe: body.rememberMe,
      })

      const response = NextResponse.json({
        success: true,
        data: {
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.fullName,
            role: session.user.role.toLowerCase(),
            avatarUrl: session.user.avatarUrl,
          },
          tenant: session.tenant,
          permissions: mfaRequired ? [] : session.permissions,
          accessToken: session.accessToken,
          mfaRequired,
        },
      })

      if (mfaRequired) {
        setMfaPendingCookie(response)
      } else {
        setRefreshCookie(response, session.refreshToken, body.rememberMe)
        await recordLoginSuccess(user.tenantId, user.id, meta.ipAddress)
      }

      return response
    } else if (body.email && body.password && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      })
      if (error || !data.user) {
        const tenantSlug = request.headers.get('x-tenant-slug')
        if (tenantSlug) {
          const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
          if (tenant) await recordLoginFailed(tenant.id, body.email, meta.ipAddress)
        }
        return NextResponse.json({ success: false, error: { message: 'Invalid credentials' } }, { status: 401 })
      }
      supabaseUserId = data.user.id
    } else if (process.env.AUTH_DEV_MODE === 'true') {
      const devEmail = process.env.DEV_USER_EMAIL?.trim().toLowerCase()
      const devUser = devEmail
        ? await resolveCanonicalUserByEmail(devEmail)
        : await prisma.user.findFirst({
            where: { role: 'OWNER', tenant: { slug: 'acme-corp' } },
            include: { tenant: true },
          })
      if (!devUser) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: devEmail
                ? `No dev user for DEV_USER_EMAIL=${devEmail}. Register first or run db:seed:user.`
                : 'No dev user — run db:seed',
            },
          },
          { status: 500 },
        )
      }
      const session = await issueSession(devUser.id, meta, { rememberMe: body.rememberMe })
      const response = NextResponse.json({
        success: true,
        data: {
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.fullName,
            role: session.user.role.toLowerCase(),
            avatarUrl: session.user.avatarUrl,
          },
          tenant: session.tenant,
          permissions: session.permissions,
          accessToken: session.accessToken,
          mfaRequired: false,
        },
      })
      setRefreshCookie(response, session.refreshToken, body.rememberMe)
      return response
    } else {
      return NextResponse.json({ success: false, error: { message: 'Missing credentials' } }, { status: 400 })
    }

    const user = await findOrLinkUserBySupabase(supabaseUserId!, body.email ?? '')
    if (!user || !user.isActive) {
      return NextResponse.json({ success: false, error: { message: 'User not provisioned' } }, { status: 403 })
    }

    const mfaRequired = user.mfaEnabled
    const session = await issueSession(user.id, meta, {
      mfaPending: mfaRequired,
      rememberMe: body.rememberMe,
    })

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.fullName,
          role: session.user.role.toLowerCase(),
          avatarUrl: session.user.avatarUrl,
        },
        tenant: session.tenant,
        permissions: mfaRequired ? [] : session.permissions,
        accessToken: session.accessToken,
        mfaRequired,
      },
    })

    if (mfaRequired) {
      setMfaPendingCookie(response)
    } else {
      setRefreshCookie(response, session.refreshToken, body.rememberMe)
      await recordLoginSuccess(user.tenantId, user.id, meta.ipAddress)
    }

    return response
  } catch (err) {
    console.error('[auth/session]', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { message: 'Invalid request body' } }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: { message: 'Session bootstrap failed' } }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { applyRateLimit } from '@/lib/security/rateLimiter'
import { extractRequestMeta } from '@/lib/audit/auditLogger'
import { recordLoginSuccess } from '@/lib/audit/securityMonitor'
import { issueSession } from '@/lib/auth/sessionService'
import { setRefreshCookie } from '@/lib/auth/sessionCookies'
import { inviteAcceptSchema } from '@/lib/auth/schemas'
import {
  acceptInvitation,
  getInvitationByToken,
  InviteAcceptError,
} from '@/lib/settings/teamService'
import { ROLE_LABELS } from '@/lib/settings/roleDefinitions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const blocked = await applyRateLimit(request, 'auth')
  if (blocked) return blocked

  try {
    const { token } = await params
    if (!token?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid invitation link' } },
        { status: 400 },
      )
    }

    const inv = await getInvitationByToken(token.trim())
    if (!inv) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid invitation link' } },
        { status: 404 },
      )
    }

    if (inv.status === 'EXPIRED') {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'This invitation has expired. Ask your admin to resend it.' },
        },
        { status: 410 },
      )
    }
    if (inv.status === 'REVOKED') {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'This invitation was revoked.' },
        },
        { status: 410 },
      )
    }
    if (inv.status === 'ACCEPTED') {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'This invitation was already accepted. Please sign in.' },
        },
        { status: 409 },
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        inviterName: inv.invitedBy.fullName,
        companyName: inv.tenant.name,
        email: inv.email,
        role: inv.role,
        roleLabel: ROLE_LABELS[inv.role],
        expiresAt: inv.expiresAt.toISOString(),
      },
    })
  } catch (err) {
    console.error('[auth/invite GET]', err)
    return NextResponse.json(
      { success: false, error: { message: 'Failed to load invitation' } },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const blocked = await applyRateLimit(request, 'auth')
  if (blocked) return blocked

  try {
    const { token } = await params
    const body = inviteAcceptSchema.parse(await request.json())

    const { user, tenant } = await acceptInvitation(token.trim(), body.password)
    const meta = extractRequestMeta(request)
    const session = await issueSession(user.id, meta)

    const response = NextResponse.json(
      {
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
        },
      },
      { status: 201 },
    )

    setRefreshCookie(response, session.refreshToken)
    await recordLoginSuccess(tenant.id, user.id, meta.ipAddress)
    return response
  } catch (err) {
    if (err instanceof InviteAcceptError) {
      return NextResponse.json(
        { success: false, error: { message: err.message, code: err.code } },
        { status: err.status },
      )
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { message: 'Validation failed', issues: err.issues } },
        { status: 400 },
      )
    }
    console.error('[auth/invite POST]', err)
    return NextResponse.json(
      { success: false, error: { message: 'Failed to accept invitation' } },
      { status: 500 },
    )
  }
}

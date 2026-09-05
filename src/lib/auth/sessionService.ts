import { prisma } from '@/lib/db/prisma'
import { signAccessToken, refreshTokenExpiresAt } from '@/lib/auth/jwt'
import { generateSecureToken, hashToken } from '@/lib/security/encryption'
import { getEffectivePermissions } from '@/lib/auth/rbac'
import { loadSessionPresentation } from '@/lib/auth/sessionAssets'
import { resolveCanonicalUserForAuth } from '@/lib/auth/resolveCanonicalUser'
import type { UserRole } from '@prisma/client'
import type { Permission } from '@/lib/auth/permissions'

export interface SessionIssueResult {
  accessToken: string
  refreshToken: string
  sessionId: string
  permissions: Permission[]
  user: {
    id: string
    email: string
    fullName: string
    role: UserRole
    tenantId: string
    mfaEnabled: boolean
    avatarUrl: string | null
  }
  tenant: {
    id: string
    name: string
    slug: string
    plan: string
    logoUrl: string | null
    primaryColor: string | null
    secondaryColor: string | null
  }
}

export async function issueSession(
  userId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null },
  options?: { mfaPending?: boolean; rememberMe?: boolean },
): Promise<SessionIssueResult> {
  const rememberMe = options?.rememberMe ?? true
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { tenant: true },
  })

  const permissions = await getEffectivePermissions(user.id, user.tenantId)
  const refreshToken = generateSecureToken(48)
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      tenantId: user.tenantId,
      sessionToken: hashToken(refreshToken),
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
      expiresAt: refreshTokenExpiresAt(rememberMe),
    },
  })

  const accessToken = await signAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    role: user.role,
    permissions,
    mfaPending: options?.mfaPending ?? false,
    sessionId: session.id,
  })

  const presentation = await loadSessionPresentation(user.id, user.tenantId)

  return {
    accessToken,
    refreshToken,
    sessionId: session.id,
    permissions,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      tenantId: user.tenantId,
      mfaEnabled: user.mfaEnabled,
      avatarUrl: presentation.avatarUrl,
    },
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      plan: user.tenant.plan.toLowerCase(),
      logoUrl: presentation.branding.logoUrl,
      primaryColor: presentation.branding.primaryColor,
      secondaryColor: presentation.branding.secondaryColor,
    },
  }
}

export async function revokeSession(refreshToken: string): Promise<void> {
  const hash = hashToken(refreshToken)
  await prisma.userSession.deleteMany({ where: { sessionToken: hash } })
}

/** Invalidate every refresh session for a user (suspend / remove). */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await prisma.userSession.deleteMany({ where: { userId } })
}

export async function validateRefreshToken(refreshToken: string) {
  const hash = hashToken(refreshToken)
  const session = await prisma.userSession.findFirst({
    where: { sessionToken: hash, expiresAt: { gt: new Date() } },
    include: { user: { include: { tenant: true } } },
  })
  return session
}

export async function findUserBySupabaseId(supabaseId: string) {
  return prisma.user.findUnique({
    where: { supabaseId },
    include: { tenant: true },
  })
}

/** Resolve Supabase login to an app user; link supabaseId when matched by email. */
export async function findOrLinkUserBySupabase(supabaseId: string, email: string) {
  return resolveCanonicalUserForAuth(supabaseId, email)
}

export async function findUserByEmail(tenantId: string, email: string) {
  return prisma.user.findFirst({
    where: { tenantId, email: email.toLowerCase() },
    include: { tenant: true },
  })
}

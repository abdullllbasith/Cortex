import { prisma } from '@/lib/db/prisma'
import { signAccessToken, refreshTokenExpiresAt } from '@/lib/auth/jwt'
import { generateSecureToken, hashToken } from '@/lib/security/encryption'
import { getEffectivePermissions } from '@/lib/auth/rbac'
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
  }
  tenant: {
    id: string
    name: string
    slug: string
    plan: string
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
    },
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      plan: user.tenant.plan.toLowerCase(),
    },
  }
}

export async function revokeSession(refreshToken: string): Promise<void> {
  const hash = hashToken(refreshToken)
  await prisma.userSession.deleteMany({ where: { sessionToken: hash } })
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

export async function findUserByEmail(tenantId: string, email: string) {
  return prisma.user.findFirst({
    where: { tenantId, email: email.toLowerCase() },
    include: { tenant: true },
  })
}

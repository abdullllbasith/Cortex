import { prisma } from '@/lib/db/prisma'
import type { UserProfileSettings } from './types'
import { parseUserProfileSettings, parseUserAgent } from './types'
import { isPersistedAssetUrl, normalizePersistedUrl } from '@/lib/storage/localUpload'

export class ProfileNotFoundError extends Error {
  constructor() {
    super('User profile not found')
    this.name = 'ProfileNotFoundError'
  }
}

export async function getUserProfile(userId: string, tenantId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId, isActive: true } })
  if (!user) throw new ProfileNotFoundError()
  const avatarUrl = isPersistedAssetUrl(user.avatarUrl) ? user.avatarUrl : null
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    jobTitle: user.jobTitle,
    phone: user.phone,
    avatarUrl,
    timezone: user.timezone,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
    profileSettings: parseUserProfileSettings(user.profileSettings),
  }
}

export async function updateUserProfile(
  userId: string,
  tenantId: string,
  data: {
    fullName?: string
    jobTitle?: string | null
    phone?: string | null
    avatarUrl?: string | null
    timezone?: string | null
    profileSettings?: UserProfileSettings
  },
) {
  const existing = await prisma.user.findFirst({ where: { id: userId, tenantId, isActive: true } })
  if (!existing) throw new ProfileNotFoundError()
  const current = parseUserProfileSettings(existing.profileSettings)
  const avatarUrl =
    data.avatarUrl !== undefined ? normalizePersistedUrl(data.avatarUrl) : undefined

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
      ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      ...(data.profileSettings
        ? { profileSettings: { ...current, ...data.profileSettings } as never }
        : {}),
    },
  })

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    jobTitle: user.jobTitle,
    phone: user.phone,
    avatarUrl: isPersistedAssetUrl(user.avatarUrl) ? user.avatarUrl : null,
    timezone: user.timezone,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
    profileSettings: parseUserProfileSettings(user.profileSettings),
  }
}

export async function listUserSessions(userId: string, tenantId: string, currentSessionId?: string) {
  const sessions = await prisma.userSession.findMany({
    where: { userId, tenantId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })

  return sessions.map((s) => ({
    id: s.id,
    device: parseUserAgent(s.userAgent),
    location: s.ipAddress ?? 'Unknown',
    lastActive: s.createdAt.toISOString(),
    isCurrent: s.id === currentSessionId,
    ipAddress: s.ipAddress,
  }))
}

export async function revokeSessionById(
  sessionId: string,
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const result = await prisma.userSession.deleteMany({
    where: { id: sessionId, userId, tenantId },
  })
  return result.count > 0
}

export async function revokeOtherSessions(
  userId: string,
  tenantId: string,
  currentSessionId?: string,
): Promise<number> {
  const result = await prisma.userSession.deleteMany({
    where: {
      userId,
      tenantId,
      ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
    },
  })
  return result.count
}

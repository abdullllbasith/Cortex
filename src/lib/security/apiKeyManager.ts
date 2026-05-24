import { prisma } from '@/lib/db/prisma'
import { generateSecureToken, hashToken } from '@/lib/security/encryption'
import type { Permission } from '@/lib/auth/permissions'

export interface GeneratedApiKey {
  id: string
  rawKey: string
  lastFourChars: string
  name: string
  permissions: Permission[]
  expiresAt: Date | null
}

export async function generateApiKey(
  tenantId: string,
  userId: string,
  name: string,
  permissions: Permission[],
  expiresAt?: Date | null,
): Promise<GeneratedApiKey> {
  const rawKey = `sk_saios_${generateSecureToken(24)}`
  const keyHash = hashToken(rawKey)
  const lastFourChars = rawKey.slice(-4)

  const record = await prisma.apiKey.create({
    data: {
      tenantId,
      userId,
      name,
      keyHash,
      lastFourChars,
      permissions,
      expiresAt: expiresAt ?? null,
    },
  })

  return {
    id: record.id,
    rawKey,
    lastFourChars,
    name,
    permissions,
    expiresAt: record.expiresAt,
  }
}

export interface ValidatedApiKey {
  keyId: string
  tenantId: string
  userId: string
  permissions: Permission[]
}

export async function validateApiKey(rawKey: string): Promise<ValidatedApiKey | null> {
  const keyHash = hashToken(rawKey)
  const record = await prisma.apiKey.findFirst({
    where: { keyHash, isActive: true },
  })

  if (!record) return null
  if (record.expiresAt && record.expiresAt < new Date()) return null

  void prisma.apiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  })

  return {
    keyId: record.id,
    tenantId: record.tenantId,
    userId: record.userId,
    permissions: record.permissions as Permission[],
  }
}

export async function revokeApiKey(keyId: string, tenantId: string): Promise<void> {
  await prisma.apiKey.updateMany({
    where: { id: keyId, tenantId },
    data: { isActive: false },
  })
}

export async function listApiKeys(tenantId: string, userId?: string) {
  return prisma.apiKey.findMany({
    where: { tenantId, ...(userId ? { userId } : {}), isActive: true },
    select: {
      id: true,
      name: true,
      lastFourChars: true,
      permissions: true,
      lastUsedAt: true,
      expiresAt: true,
      isActive: true,
      createdAt: true,
      user: { select: { fullName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

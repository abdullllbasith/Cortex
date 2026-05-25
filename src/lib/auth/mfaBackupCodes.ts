import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { hashToken } from '@/lib/security/encryption'

const BACKUP_CODE_COUNT = 8
const BACKUP_CODE_BYTES = 4

export function generatePlainBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(BACKUP_CODE_BYTES).toString('hex').slice(0, 8).toUpperCase(),
  )
}

function hashBackupCode(code: string): string {
  return hashToken(code.trim().toUpperCase())
}

type ProfileSettings = {
  mfaBackupCodesHashed?: string[]
}

function readProfileSettings(raw: unknown): ProfileSettings {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as ProfileSettings
  }
  return {}
}

export async function storeBackupCodeHashes(userId: string, plainCodes: string[]) {
  const hashed = plainCodes.map(hashBackupCode)
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const profile = readProfileSettings(user.profileSettings)
  await prisma.user.update({
    where: { id: userId },
    data: {
      profileSettings: {
        ...profile,
        mfaBackupCodesHashed: hashed,
      },
    },
  })
  return plainCodes
}

export async function verifyAndConsumeBackupCode(
  userId: string,
  code: string,
): Promise<boolean> {
  const normalized = code.trim().toUpperCase()
  if (normalized.length < 8) return false

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const profile = readProfileSettings(user.profileSettings)
  const stored = profile.mfaBackupCodesHashed ?? []
  const hashed = hashBackupCode(normalized)
  const index = stored.indexOf(hashed)
  if (index === -1) return false

  const remaining = stored.filter((_, i) => i !== index)
  await prisma.user.update({
    where: { id: userId },
    data: {
      profileSettings: {
        ...profile,
        mfaBackupCodesHashed: remaining,
      },
    },
  })
  return true
}

export async function getRemainingBackupCodeCount(userId: string): Promise<number> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const profile = readProfileSettings(user.profileSettings)
  return profile.mfaBackupCodesHashed?.length ?? 0
}

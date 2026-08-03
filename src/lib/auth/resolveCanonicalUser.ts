import { prisma } from '@/lib/db/prisma'
import { normalizeEmail } from '@/lib/auth/emailAvailability'
import type { Tenant, User } from '@prisma/client'

export type UserWithTenant = User & { tenant: Tenant }

async function releaseSupabaseId(supabaseId: string, keepUserId: string): Promise<void> {
  const conflicts = await prisma.user.findMany({
    where: { supabaseId, NOT: { id: keepUserId } },
    select: { id: true },
  })

  for (const conflict of conflicts) {
    await prisma.user.update({
      where: { id: conflict.id },
      data: { supabaseId: `legacy-${conflict.id}` },
    })
  }
}

export async function linkSupabaseIdToUser(userId: string, supabaseId: string): Promise<void> {
  await releaseSupabaseId(supabaseId, userId)
  await prisma.user.update({
    where: { id: userId },
    data: { supabaseId },
  })
}

/** Resolve Supabase login to the single application user for this email. */
export async function resolveCanonicalUserForAuth(
  supabaseId: string,
  email: string,
): Promise<UserWithTenant | null> {
  const normalized = normalizeEmail(email)

  if (normalized) {
    const byEmail = await prisma.user.findFirst({
      where: { email: normalized, isActive: true },
      include: { tenant: true },
    })
    if (byEmail?.isActive) {
      if (byEmail.supabaseId !== supabaseId) {
        await linkSupabaseIdToUser(byEmail.id, supabaseId)
      }
      return byEmail
    }
  }

  const bySupabase = await prisma.user.findUnique({
    where: { supabaseId },
    include: { tenant: true },
  })
  return bySupabase?.isActive ? bySupabase : null
}

export async function resolveCanonicalUserByEmail(email: string): Promise<UserWithTenant | null> {
  const normalized = normalizeEmail(email)
  if (!normalized) return null

  return prisma.user.findFirst({
    where: { email: normalized, isActive: true },
    include: { tenant: true },
  })
}

import { timingSafeEqual } from 'crypto'
import type { AdminRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { createSupabaseServerClient } from '@/lib/auth/supabaseServer'
import type { AdminAuthContext } from '@/middleware/adminAuth'
import { signAdminAccessToken } from '@/lib/auth/adminJwt'

function safeCompare(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function getPlatformAdminCredentials(): { email: string; password: string } | null {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.PLATFORM_ADMIN_PASSWORD?.trim()
  if (!email || !password) return null
  return { email, password }
}

async function upsertPlatformAdminUser(email: string, supabaseId: string): Promise<AdminAuthContext> {
  const admin = await prisma.adminUser.upsert({
    where: { supabaseId },
    create: {
      supabaseId,
      email,
      fullName: 'Platform Admin',
      role: 'SUPER_ADMIN',
      permissions: ['*'],
      lastLoginAt: new Date(),
    },
    update: {
      email,
      lastLoginAt: new Date(),
    },
  })

  return {
    adminUserId: admin.id,
    supabaseId: admin.supabaseId,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role,
    permissions: ['*'],
  }
}

async function resolveSupabaseAdmin(email: string, password: string): Promise<AdminAuthContext | null> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return null

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) return null

  const isSuperAdmin =
    data.user.app_metadata?.is_super_admin === true ||
    data.user.user_metadata?.is_super_admin === true

  if (!isSuperAdmin) return null

  return upsertPlatformAdminUser(data.user.email ?? email, data.user.id)
}

export async function authenticatePlatformAdmin(
  email: string,
  password: string,
): Promise<AdminAuthContext | null> {
  const normalizedEmail = email.trim().toLowerCase()
  const platformCredentials = getPlatformAdminCredentials()

  if (platformCredentials) {
    if (normalizedEmail !== platformCredentials.email) return null
    if (!safeCompare(password, platformCredentials.password)) return null

    const supabaseId = `platform-admin:${platformCredentials.email}`
    return upsertPlatformAdminUser(platformCredentials.email, supabaseId)
  }

  return resolveSupabaseAdmin(normalizedEmail, password)
}

export async function issueAdminSession(auth: AdminAuthContext): Promise<string> {
  return signAdminAccessToken({
    sub: auth.adminUserId,
    supabaseId: auth.supabaseId,
    email: auth.email,
    fullName: auth.fullName,
    role: auth.role as AdminRole,
  })
}

export function isPlatformAdminLoginConfigured(): boolean {
  return Boolean(getPlatformAdminCredentials()) || Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim())
}

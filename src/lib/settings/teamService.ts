import { randomBytes } from 'crypto'
import type { TenantPlan, UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { PLAN_LIMITS } from '@/lib/settings/billingService'
import { ROLE_LABELS } from '@/lib/settings/roleDefinitions'
import { sendTeamInviteEmail } from '@/lib/email/teamInviteEmail'

const INVITE_TTL_HOURS = 48

export interface TeamMemberDTO extends Record<string, unknown> {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  role: UserRole
  customRoleId: string | null
  customRoleName: string | null
  lastLoginAt: string | null
  isActive: boolean
  status: 'Active' | 'Suspended'
  createdAt: string
}

export interface TeamInvitationDTO {
  id: string
  email: string
  role: UserRole
  roleLabel: string
  message: string | null
  status: string
  sentAt: string
  expiresAt: string
  invitedByName: string
}

export interface TeamOverviewDTO {
  stats: {
    totalMembers: number
    pendingInvitations: number
    seatsUsed: number
    seatLimit: number
    plan: TenantPlan
  }
  members: TeamMemberDTO[]
  invitations: TeamInvitationDTO[]
}

function inviteExpiry(): Date {
  const d = new Date()
  d.setHours(d.getHours() + INVITE_TTL_HOURS)
  return d
}

export async function getTeamOverview(tenantId: string): Promise<TeamOverviewDTO> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
  const limits = PLAN_LIMITS[tenant.plan]

  const [members, pendingInvites, pendingCount] = await Promise.all([
    prisma.user.findMany({
      where: {
        tenantId,
        // Soft-removed members are hidden from the roster
        NOT: { email: { endsWith: '@deleted.local' } },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        customRoleId: true,
        customRole: { select: { name: true } },
        lastLoginAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    }),
    prisma.teamInvitation.findMany({
      where: { tenantId, status: 'PENDING', expiresAt: { gt: new Date() } },
      include: { invitedBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.teamInvitation.count({
      where: { tenantId, status: 'PENDING', expiresAt: { gt: new Date() } },
    }),
  ])

  const activeMembers = members.filter((m) => m.isActive).length
  const seatsUsed = activeMembers + pendingCount

  return {
    stats: {
      totalMembers: members.length,
      pendingInvitations: pendingCount,
      seatsUsed,
      seatLimit: limits.teamMembers,
      plan: tenant.plan,
    },
    members: members.map((m) => ({
      id: m.id,
      email: m.email,
      fullName: m.fullName,
      avatarUrl: m.avatarUrl,
      role: m.role,
      customRoleId: m.customRoleId,
      customRoleName: m.customRole?.name ?? null,
      lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
      isActive: m.isActive,
      status: m.isActive ? 'Active' : 'Suspended',
      createdAt: m.createdAt.toISOString(),
    })),
    invitations: pendingInvites.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      roleLabel: ROLE_LABELS[inv.role],
      message: inv.message,
      status: inv.status,
      sentAt: inv.createdAt.toISOString(),
      expiresAt: inv.expiresAt.toISOString(),
      invitedByName: inv.invitedBy.fullName,
    })),
  }
}

export async function changeMemberRole(
  tenantId: string,
  userId: string,
  role: UserRole,
  changedById: string,
) {
  const target = await prisma.user.findFirst({ where: { id: userId, tenantId } })
  if (!target) throw new Error('User not found')

  if (target.role === 'OWNER' && role !== 'OWNER') {
    const ownerCount = await prisma.user.count({
      where: { tenantId, role: 'OWNER', isActive: true },
    })
    if (ownerCount <= 1) {
      throw new Error('Cannot change role of the last workspace owner')
    }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: { role, customRoleId: null },
    }),
    prisma.roleChange.create({
      data: {
        tenantId,
        userId: target.id,
        changedById,
        previousRole: target.role,
        newRole: role,
      },
    }),
  ])

  return { userId: target.id, role }
}

export async function setMemberStatus(
  tenantId: string,
  userId: string,
  isActive: boolean,
  actorId: string,
) {
  const target = await prisma.user.findFirst({ where: { id: userId, tenantId } })
  if (!target) throw new Error('User not found')
  if (target.id === actorId && !isActive) {
    throw new Error('You cannot suspend your own account')
  }
  if (target.role === 'OWNER' && !isActive) {
    const ownerCount = await prisma.user.count({
      where: { tenantId, role: 'OWNER', isActive: true },
    })
    if (ownerCount <= 1) throw new Error('Cannot suspend the last workspace owner')
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { isActive },
  })

  if (!isActive) {
    const { revokeAllSessionsForUser } = await import('@/lib/auth/sessionService')
    await revokeAllSessionsForUser(target.id)
    await prisma.apiKey.updateMany({
      where: { userId: target.id, tenantId },
      data: { isActive: false },
    })
    await banSupabaseUser(target.supabaseId, true)
  } else {
    await banSupabaseUser(target.supabaseId, false)
  }

  return { userId: target.id, isActive }
}

export async function removeMember(tenantId: string, userId: string, actorId: string) {
  const target = await prisma.user.findFirst({ where: { id: userId, tenantId } })
  if (!target) throw new Error('User not found')
  if (target.id === actorId) throw new Error('You cannot remove yourself')
  if (target.role === 'OWNER') {
    const ownerCount = await prisma.user.count({
      where: { tenantId, role: 'OWNER', isActive: true },
    })
    if (ownerCount <= 1) throw new Error('Cannot remove the last workspace owner')
  }

  const { revokeAllSessionsForUser } = await import('@/lib/auth/sessionService')
  await revokeAllSessionsForUser(target.id)
  await prisma.apiKey.updateMany({
    where: { userId: target.id, tenantId },
    data: { isActive: false },
  })

  // Remove auth identity so they cannot sign in again; free email for re-invite
  await deleteSupabaseUser(target.supabaseId)

  try {
    await prisma.user.delete({ where: { id: target.id } })
  } catch {
    // FK history may block hard delete — soft-remove and hide from roster
    await prisma.user.update({
      where: { id: target.id },
      data: {
        isActive: false,
        email: `removed.${target.id}@deleted.local`,
        supabaseId: `removed-${target.id}`,
        fullName: `${target.fullName} (removed)`,
        role: 'EMPLOYEE',
        customRoleId: null,
        mfaEnabled: false,
        mfaSecretEnc: null,
      },
    })
  }

  return { removed: true }
}

async function banSupabaseUser(supabaseId: string, banned: boolean) {
  if (!supabaseId || supabaseId.startsWith('dev-') || supabaseId.startsWith('removed-')) return
  try {
    const { createSupabaseAdminClient } = await import('@/lib/auth/supabaseServer')
    const admin = createSupabaseAdminClient()
    if (!admin) return
    if (banned) {
      await admin.auth.admin.updateUserById(supabaseId, { ban_duration: '876000h' })
    } else {
      await admin.auth.admin.updateUserById(supabaseId, { ban_duration: 'none' })
    }
  } catch (err) {
    console.warn('[team] supabase ban/unban failed', err)
  }
}

async function deleteSupabaseUser(supabaseId: string) {
  if (!supabaseId || supabaseId.startsWith('dev-') || supabaseId.startsWith('removed-')) return
  try {
    const { createSupabaseAdminClient } = await import('@/lib/auth/supabaseServer')
    const admin = createSupabaseAdminClient()
    if (!admin) return
    await admin.auth.admin.deleteUser(supabaseId)
  } catch (err) {
    console.warn('[team] supabase delete user failed', err)
  }
}

export async function createInvitations(
  tenantId: string,
  invitedById: string,
  invites: Array<{ email: string; role: UserRole }>,
  message?: string,
  appUrl?: string,
) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
  const inviter = await prisma.user.findUniqueOrThrow({ where: { id: invitedById } })
  const limits = PLAN_LIMITS[tenant.plan]

  const [activeCount, pendingCount] = await Promise.all([
    prisma.user.count({ where: { tenantId, isActive: true } }),
    prisma.teamInvitation.count({
      where: { tenantId, status: 'PENDING', expiresAt: { gt: new Date() } },
    }),
  ])

  if (activeCount + pendingCount + invites.length > limits.teamMembers) {
    throw new Error(
      `Seat limit reached (${limits.teamMembers} on ${tenant.plan} plan). Upgrade to invite more members.`,
    )
  }

  const normalized = invites.map((i) => ({
    email: i.email.trim().toLowerCase(),
    role: i.role,
  }))

  const existingUsers = await prisma.user.findMany({
    where: { email: { in: normalized.map((i) => i.email) } },
    select: { email: true, tenantId: true },
  })
  if (existingUsers.length > 0) {
    const inTenant = existingUsers.filter((u) => u.tenantId === tenantId).map((u) => u.email)
    const elsewhere = existingUsers.filter((u) => u.tenantId !== tenantId).map((u) => u.email)
    if (inTenant.length > 0) {
      throw new Error(`Already members: ${inTenant.join(', ')}`)
    }
    if (elsewhere.length > 0) {
      throw new Error(
        `Already registered on Cortex: ${elsewhere.join(', ')}. Use a different email or ask them to sign in.`,
      )
    }
  }

  const expiresAt = inviteExpiry()
  const created = await prisma.$transaction(
    normalized.map((inv) =>
      prisma.teamInvitation.upsert({
        where: {
          tenantId_email: { tenantId, email: inv.email },
        },
        create: {
          tenantId,
          email: inv.email,
          role: inv.role,
          message: message ?? null,
          invitedById,
          token: randomBytes(24).toString('hex'),
          expiresAt,
          status: 'PENDING',
        },
        update: {
          role: inv.role,
          message: message ?? null,
          invitedById,
          token: randomBytes(24).toString('hex'),
          expiresAt,
          status: 'PENDING',
          updatedAt: new Date(),
        },
      }),
    ),
  )

  const baseUrl = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  for (const inv of created) {
    await sendTeamInviteEmail({
      to: inv.email,
      tenantName: tenant.name,
      inviterName: inviter.fullName,
      role: inv.role,
      token: inv.token,
      message,
      appUrl: baseUrl,
    })
  }

  return created.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    roleLabel: ROLE_LABELS[inv.role],
    expiresAt: inv.expiresAt.toISOString(),
  }))
}

export async function resendInvitation(tenantId: string, invitationId: string, appUrl?: string) {
  const inv = await prisma.teamInvitation.findFirst({
    where: { id: invitationId, tenantId, status: 'PENDING' },
    include: { invitedBy: true, tenant: true },
  })
  if (!inv) throw new Error('Invitation not found')

  const updated = await prisma.teamInvitation.update({
    where: { id: inv.id },
    data: {
      token: randomBytes(24).toString('hex'),
      expiresAt: inviteExpiry(),
      updatedAt: new Date(),
    },
  })

  const baseUrl = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  await sendTeamInviteEmail({
    to: updated.email,
    tenantName: inv.tenant.name,
    inviterName: inv.invitedBy.fullName,
    role: updated.role,
    token: updated.token,
    message: updated.message,
    appUrl: baseUrl,
  })

  return updated
}

export async function revokeInvitation(tenantId: string, invitationId: string) {
  const inv = await prisma.teamInvitation.findFirst({
    where: { id: invitationId, tenantId, status: 'PENDING' },
  })
  if (!inv) throw new Error('Invitation not found')

  await prisma.teamInvitation.update({
    where: { id: inv.id },
    data: { status: 'REVOKED' },
  })

  return { revoked: true }
}

export class InviteAcceptError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'InviteAcceptError'
  }
}

export async function getInvitationByToken(token: string) {
  const inv = await prisma.teamInvitation.findUnique({
    where: { token },
    include: {
      tenant: { select: { id: true, name: true, slug: true, plan: true } },
      invitedBy: { select: { fullName: true } },
    },
  })
  if (!inv) return null

  if (inv.status === 'PENDING' && inv.expiresAt.getTime() < Date.now()) {
    await prisma.teamInvitation.update({
      where: { id: inv.id },
      data: { status: 'EXPIRED' },
    })
    return { ...inv, status: 'EXPIRED' as const }
  }

  return inv
}

/**
 * Accept a team invite: create Supabase + Prisma user, mark invitation accepted.
 * Does not require an existing auth session (invitee is not logged in yet).
 */
export async function acceptInvitation(token: string, password: string) {
  const inv = await getInvitationByToken(token)
  if (!inv) {
    throw new InviteAcceptError('Invalid invitation link', 404, 'INVITE_NOT_FOUND')
  }
  if (inv.status === 'ACCEPTED') {
    throw new InviteAcceptError('This invitation was already accepted. Please sign in.', 409, 'INVITE_ACCEPTED')
  }
  if (inv.status === 'REVOKED') {
    throw new InviteAcceptError('This invitation was revoked. Ask your admin for a new invite.', 410, 'INVITE_REVOKED')
  }
  if (inv.status === 'EXPIRED' || inv.expiresAt.getTime() < Date.now()) {
    if (inv.status === 'PENDING') {
      await prisma.teamInvitation.update({ where: { id: inv.id }, data: { status: 'EXPIRED' } })
    }
    throw new InviteAcceptError('This invitation has expired. Ask your admin to resend it.', 410, 'INVITE_EXPIRED')
  }
  if (inv.status !== 'PENDING') {
    throw new InviteAcceptError('This invitation is no longer valid', 400, 'INVITE_INVALID')
  }

  const email = inv.email.trim().toLowerCase()
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    throw new InviteAcceptError(
      'An account with this email already exists. Sign in instead.',
      409,
      'EMAIL_ALREADY_REGISTERED',
    )
  }

  const activeCount = await prisma.user.count({
    where: { tenantId: inv.tenantId, isActive: true },
  })
  const limits = PLAN_LIMITS[inv.tenant.plan]
  if (activeCount >= limits.teamMembers) {
    throw new InviteAcceptError(
      `This workspace has reached its seat limit (${limits.teamMembers}). Ask the owner to upgrade.`,
      403,
      'SEAT_LIMIT',
    )
  }

  const { createSupabaseAdminClient } = await import('@/lib/auth/supabaseServer')
  const admin = createSupabaseAdminClient()
  const fullName = email.split('@')[0] || 'Team member'
  let supabaseId: string

  if (admin) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        tenant_slug: inv.tenant.slug,
        invited: true,
      },
    })
    if (error || !data.user) {
      const msg = error?.message ?? 'Could not create account'
      if (/already|registered|exists/i.test(msg)) {
        throw new InviteAcceptError(
          'An account with this email already exists. Sign in instead.',
          409,
          'EMAIL_ALREADY_REGISTERED',
        )
      }
      throw new InviteAcceptError(msg, 400, 'AUTH_CREATE_FAILED')
    }
    supabaseId = data.user.id
  } else if (process.env.AUTH_DEV_MODE === 'true') {
    supabaseId = `dev-invite-${email.replace(/[^a-z0-9]/gi, '-')}`
  } else {
    throw new InviteAcceptError('Authentication service unavailable', 503, 'AUTH_UNAVAILABLE')
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId: inv.tenantId,
          supabaseId,
          email,
          fullName,
          role: inv.role,
          customRoleId: inv.customRoleId,
        },
      })
      await tx.teamInvitation.update({
        where: { id: inv.id },
        data: { status: 'ACCEPTED' },
      })
      return created
    })

    return {
      user,
      tenant: inv.tenant,
      invitedByName: inv.invitedBy.fullName,
    }
  } catch (err) {
    // Roll back orphaned Supabase user if DB write fails
    if (admin && supabaseId) {
      await admin.auth.admin.deleteUser(supabaseId).catch(() => undefined)
    }
    throw err
  }
}

export async function bulkChangeRoles(
  tenantId: string,
  userIds: string[],
  role: UserRole,
  changedById: string,
) {
  const results = []
  for (const userId of userIds) {
    results.push(await changeMemberRole(tenantId, userId, role, changedById))
  }
  return results
}

export async function bulkRemoveMembers(tenantId: string, userIds: string[], actorId: string) {
  for (const userId of userIds) {
    await removeMember(tenantId, userId, actorId)
  }
  return { removed: userIds.length }
}

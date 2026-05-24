import { randomBytes } from 'crypto'
import type { TenantPlan, UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { PLAN_LIMITS } from '@/lib/settings/billingService'
import { ROLE_LABELS } from '@/lib/settings/roleDefinitions'

const INVITE_TTL_DAYS = 7

export interface TeamMemberDTO {
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
  d.setDate(d.getDate() + INVITE_TTL_DAYS)
  return d
}

export async function getTeamOverview(tenantId: string): Promise<TeamOverviewDTO> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
  const limits = PLAN_LIMITS[tenant.plan]

  const [members, pendingInvites, pendingCount] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
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

  await prisma.user.update({
    where: { id: target.id },
    data: { isActive: false, role: 'EMPLOYEE' },
  })

  return { removed: true }
}

export async function createInvitations(
  tenantId: string,
  invitedById: string,
  invites: Array<{ email: string; role: UserRole }>,
  message?: string,
) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
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
    where: { tenantId, email: { in: normalized.map((i) => i.email) } },
    select: { email: true },
  })
  if (existingUsers.length > 0) {
    throw new Error(`Already members: ${existingUsers.map((u) => u.email).join(', ')}`)
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

  // Log for dev — production would send email via provider
  for (const inv of created) {
    console.info('[team-invite]', inv.email, inv.token)
  }

  return created.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    roleLabel: ROLE_LABELS[inv.role],
    expiresAt: inv.expiresAt.toISOString(),
  }))
}

export async function resendInvitation(tenantId: string, invitationId: string) {
  const inv = await prisma.teamInvitation.findFirst({
    where: { id: invitationId, tenantId, status: 'PENDING' },
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

  console.info('[team-invite-resend]', updated.email, updated.token)
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

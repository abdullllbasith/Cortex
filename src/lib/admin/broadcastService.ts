import type { AnnouncementType, TenantPlan } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { notificationService } from '@/lib/notifications/notificationService'
import { formatEmailHtml, sendEmailNotification } from '@/lib/notifications/channels/emailChannel'
import { isEmailConfigured } from '@/lib/email/mailTransport'

export interface AnnouncementInput {
  title: string
  body: string
  type: AnnouncementType
  targetPlans?: TenantPlan[]
  targetTenantIds?: string[]
  scheduledAt?: Date | null
  expiresAt?: Date | null
  isActive?: boolean
  createdById: string
  sendEmail?: boolean
}

function platformEmailHtml(title: string, body: string, type: AnnouncementType): string {
  const accent =
    type === 'URGENT' ? '#dc2626' : type === 'MAINTENANCE' ? '#d97706' : '#4f46e5'
  const cta = `<p style="margin-top:20px"><a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://saios.app'}/dashboard" style="background:${accent};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Open SAIOS</a></p>`
  return `<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;color:#0f172a;max-width:560px;margin:0 auto">
    <div style="border-bottom:3px solid ${accent};padding-bottom:12px;margin-bottom:20px">
      <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:${accent};margin:0">SAIOS Platform</p>
      <h1 style="margin:8px 0 0;font-size:22px">${title}</h1>
    </div>
    <div style="line-height:1.6;color:#334155">${body.replace(/\n/g, '<br/>')}</div>
    ${cta}
    <p style="margin-top:32px;font-size:12px;color:#94a3b8">You received this because you are an owner on a SAIOS workspace.</p>
  </body></html>`
}

async function resolveTargetTenants(input: AnnouncementInput) {
  if (input.targetTenantIds?.length) {
    return prisma.tenant.findMany({
      where: { id: { in: input.targetTenantIds } },
      select: { id: true, name: true, plan: true },
    })
  }

  if (input.targetPlans?.length) {
    return prisma.tenant.findMany({
      where: { plan: { in: input.targetPlans } },
      select: { id: true, name: true, plan: true },
    })
  }

  return prisma.tenant.findMany({
    select: { id: true, name: true, plan: true },
  })
}

async function resolveAdminUserId(adminUserId: string): Promise<string> {
  if (adminUserId === 'dev-admin') {
    const admin = await prisma.adminUser.upsert({
      where: { supabaseId: 'dev-admin-supabase' },
      create: {
        supabaseId: 'dev-admin-supabase',
        email: 'admin@saios.local',
        fullName: 'Dev Admin',
        role: 'SUPER_ADMIN',
        permissions: ['*'],
      },
      update: {},
    })
    return admin.id
  }
  return adminUserId
}

export async function sendAnnouncement(input: AnnouncementInput) {
  const createdById = await resolveAdminUserId(input.createdById)
  const announcement = await prisma.platformAnnouncement.create({
    data: {
      title: input.title,
      body: input.body,
      type: input.type,
      targetPlans: input.targetPlans ?? [],
      scheduledAt: input.scheduledAt ?? null,
      expiresAt: input.expiresAt ?? null,
      isActive: input.isActive ?? true,
      createdById,
    },
  })

  const tenants = await resolveTargetTenants(input)
  let notifiedUsers = 0
  let emailsSent = 0

  for (const tenant of tenants) {
    const owners = await prisma.user.findMany({
      where: { tenantId: tenant.id, role: 'OWNER', isActive: true },
      select: { id: true },
    })

    if (owners.length === 0) continue

    await notificationService.send({
      tenantId: tenant.id,
      userIds: owners.map((o) => o.id),
      title: input.title,
      body: input.body,
      type: 'SYSTEM',
      severity: input.type === 'URGENT' ? 'CRITICAL' : 'INFO',
      actionUrl: '/dashboard',
      actionLabel: 'View in SAIOS',
      entityId: announcement.id,
      metadata: {
        announcementId: announcement.id,
        announcementType: input.type,
        platformBroadcast: true,
      },
    })
    notifiedUsers += owners.length

    if (input.sendEmail !== false && isEmailConfigured()) {
      for (const owner of owners) {
        await sendEmailNotification({
          tenantId: tenant.id,
          userId: owner.id,
          subject: `[SAIOS] ${input.title}`,
          text: `${input.title}\n\n${input.body}`,
          html: platformEmailHtml(input.title, input.body, input.type),
        })
        emailsSent++
      }
    }
  }

  return {
    announcement,
    stats: {
      tenantsTargeted: tenants.length,
      usersNotified: notifiedUsers,
      emailsSent,
    },
  }
}

export async function listAnnouncements(activeOnly = false) {
  return prisma.platformAnnouncement.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { fullName: true, email: true } } },
  })
}

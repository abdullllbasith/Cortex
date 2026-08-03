import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'

export async function listCompanies(tenantId: string, search?: string) {
  return prisma.crmCompany.findMany({
    where: {
      tenantId,
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    },
    orderBy: { name: 'asc' },
    include: {
      owner: { select: { id: true, fullName: true, avatarUrl: true } },
      _count: { select: { contacts: true, deals: true } },
    },
  })
}

export async function createCompany(tenantId: string, data: Record<string, unknown>) {
  return prisma.crmCompany.create({
    data: {
      tenantId,
      name: String(data.name),
      industry: (data.industry as string) ?? null,
      size: (data.size as string) ?? null,
      website: (data.website as string) ?? null,
      phone: (data.phone as string) ?? null,
      address: (data.address as Prisma.InputJsonValue) ?? {},
      ownerId: (data.ownerId as string) ?? null,
      tags: (data.tags as string[]) ?? [],
      annualRevenue: data.annualRevenue != null ? new Decimal(Number(data.annualRevenue)) : null,
      employeeCount: data.employeeCount != null ? Number(data.employeeCount) : null,
    },
  })
}

export async function updateCompany(tenantId: string, id: string, data: Record<string, unknown>) {
  const result = await prisma.crmCompany.updateMany({
    where: { id, tenantId },
    data: {
      ...(data.name !== undefined && { name: String(data.name) }),
      ...(data.industry !== undefined && { industry: (data.industry as string) ?? null }),
      ...(data.size !== undefined && { size: (data.size as string) ?? null }),
      ...(data.website !== undefined && { website: (data.website as string) ?? null }),
      ...(data.phone !== undefined && { phone: (data.phone as string) ?? null }),
      ...(data.ownerId !== undefined && { ownerId: (data.ownerId as string) ?? null }),
      ...(data.tags !== undefined && { tags: data.tags as string[] }),
      ...(data.annualRevenue !== undefined && {
        annualRevenue: data.annualRevenue != null ? new Decimal(Number(data.annualRevenue)) : null,
      }),
      ...(data.employeeCount !== undefined && {
        employeeCount: data.employeeCount != null ? Number(data.employeeCount) : null,
      }),
    },
  })
  if (!result.count) throw new Error('Company not found')
  return prisma.crmCompany.findFirst({ where: { id, tenantId } })
}

export async function deleteCompany(tenantId: string, id: string) {
  await prisma.crmCompany.deleteMany({ where: { id, tenantId } })
  return { deleted: true }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { FeatureFlagScope, TenantPlan } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'

const createSchema = z.object({
  key: z.string().min(2).max(80).regex(/^[a-z0-9_.-]+$/),
  description: z.string().max(500).optional(),
  enabledFor: z.enum(['ALL', 'NONE', 'SPECIFIC_TENANTS', 'SPECIFIC_PLANS']).optional(),
  targetTenantIds: z.array(z.string()).optional(),
  targetPlans: z.array(z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE'])).optional(),
  isEnabled: z.boolean().optional(),
})

const updateSchema = createSchema.partial().extend({
  id: z.string().optional(),
  key: z.string().min(2).max(80).regex(/^[a-z0-9_.-]+$/).optional(),
})

export const GET = requireAdminAuth(async () => {
  try {
    const flags = await prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
      include: { updatedBy: { select: { fullName: true, email: true } } },
    })
    return NextResponse.json(apiSuccess(flags))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = requireAdminAuth(async (request, { auth }) => {
  try {
    const body = createSchema.parse(await request.json())
    const flag = await prisma.featureFlag.create({
      data: {
        key: body.key,
        description: body.description ?? null,
        enabledFor: (body.enabledFor ?? 'NONE') as FeatureFlagScope,
        targetTenantIds: body.targetTenantIds ?? [],
        targetPlans: (body.targetPlans ?? []) as TenantPlan[],
        isEnabled: body.isEnabled ?? false,
        updatedById: auth.adminUserId === 'dev-admin' ? null : auth.adminUserId,
      },
    })
    return NextResponse.json(apiSuccess(flag), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = requireAdminAuth(async (request, { auth }) => {
  try {
    const body = updateSchema.parse(await request.json())
    if (!body.id && !body.key) {
      return NextResponse.json(
        { success: false, error: { message: 'id or key required', code: 'VALIDATION_ERROR' } },
        { status: 400 },
      )
    }

    const existing = body.id
      ? await prisma.featureFlag.findUnique({ where: { id: body.id } })
      : await prisma.featureFlag.findUnique({ where: { key: body.key! } })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: 'Feature flag not found', code: 'NOT_FOUND' } },
        { status: 404 },
      )
    }

    const flag = await prisma.featureFlag.update({
      where: { id: existing.id },
      data: {
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.enabledFor ? { enabledFor: body.enabledFor as FeatureFlagScope } : {}),
        ...(body.targetTenantIds ? { targetTenantIds: body.targetTenantIds } : {}),
        ...(body.targetPlans ? { targetPlans: body.targetPlans as TenantPlan[] } : {}),
        ...(body.isEnabled !== undefined ? { isEnabled: body.isEnabled } : {}),
        updatedById: auth.adminUserId === 'dev-admin' ? null : auth.adminUserId,
      },
    })

    return NextResponse.json(apiSuccess(flag))
  } catch (err) {
    return handleRouteError(err)
  }
})

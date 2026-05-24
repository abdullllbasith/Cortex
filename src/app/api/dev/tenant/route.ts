import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/knowledge/response'

export async function GET(request: NextRequest) {
  if (process.env.AUTH_DEV_MODE !== 'true') {
    return apiError('Not available', 'FORBIDDEN', 403)
  }

  const tenantId = request.nextUrl.searchParams.get('tenantId')
  const tenant = tenantId
    ? await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true, plan: true },
      })
    : await prisma.tenant.findFirst({
        where: { slug: 'acme-corp' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, slug: true, plan: true },
      })

  if (!tenant) {
    return apiError('No seed tenant found. Run npm run db:seed', 'NO_TENANT', 404)
  }

  const owner = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: 'OWNER', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, fullName: true, role: true },
  })

  return NextResponse.json(
    apiSuccess({
      ...tenant,
      plan: tenant.plan.toLowerCase(),
      user: owner
        ? {
            id: owner.id,
            email: owner.email,
            name: owner.fullName,
            role: owner.role.toLowerCase(),
          }
        : null,
    }),
  )
}

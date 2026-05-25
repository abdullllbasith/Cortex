import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { prisma } from '@/lib/db/prisma'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const items = await prisma.user.findMany({
      where: { tenantId: auth.tenantId, isActive: true },
      select: { id: true, fullName: true, avatarUrl: true, email: true },
      orderBy: { fullName: 'asc' },
    })
    return NextResponse.json(apiSuccess({ items }))
  } catch (err) {
    return handleRouteError(err)
  }
})

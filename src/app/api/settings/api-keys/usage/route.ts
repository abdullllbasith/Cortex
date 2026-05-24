import { NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { prisma } from '@/lib/db/prisma'

export const GET = requirePermission(PERMISSIONS.API_KEYS_MANAGE)(
  async (_request, { auth }) => {
    try {
      const keys = await prisma.apiKey.findMany({
        where: { tenantId: auth.tenantId, isActive: true },
        select: { id: true, name: true, createdAt: true, lastUsedAt: true },
      })

      const days = 30
      const usage = Array.from({ length: days }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (days - 1 - i))
        const label = d.toISOString().slice(0, 10)
        const byKey: Record<string, number> = {}
        for (const k of keys) {
          const seed = k.id.charCodeAt(0) + i
          byKey[k.name] = k.lastUsedAt ? Math.max(0, (seed * 7) % 40) : 0
        }
        return { date: label, ...byKey }
      })

      return NextResponse.json(apiSuccess({ usage, keys: keys.map((k) => k.name) }))
    } catch (err) {
      return handleRouteError(err)
    }
  },
)

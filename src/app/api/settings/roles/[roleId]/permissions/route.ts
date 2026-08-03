import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { invalidatePermissionCache } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import {
  updateBuiltinRolePermissions,
  updateCustomRolePermissions,
} from '@/lib/settings/rolesService'
import { isBuiltinRoleId } from '@/lib/settings/permissionCategories'
import type { UserRole } from '@prisma/client'

const schema = z.object({
  categories: z.record(z.string(), z.boolean()),
})

export const PUT = requirePermission(PERMISSIONS.TEAM_MANAGE)(async (request, { auth, params }) => {
  try {
    const { roleId } = await params
    const body = schema.parse(await request.json())

    if (isBuiltinRoleId(roleId)) {
      const result = await updateBuiltinRolePermissions(
        auth.tenantId,
        roleId as UserRole,
        body.categories,
      )
      const affected = await prisma.user.findMany({
        where: { tenantId: auth.tenantId, role: roleId as UserRole },
        select: { id: true },
      })
      for (const u of affected) {
        await invalidatePermissionCache(u.id, auth.tenantId)
      }
      return NextResponse.json(apiSuccess(result))
    }

    const result = await updateCustomRolePermissions(auth.tenantId, roleId, body.categories)
    for (const userId of result.invalidatedUsers) {
      await invalidatePermissionCache(userId, auth.tenantId)
    }
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { updateCustomRole, deleteCustomRole } from '@/lib/settings/rolesService'

const updateSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(500).nullable().optional(),
})

export const PUT = requirePermission(PERMISSIONS.TEAM_MANAGE)(async (request, { auth, params }) => {
  try {
    const { roleId } = await params
    const body = updateSchema.parse(await request.json())
    const role = await updateCustomRole(auth.tenantId, roleId, body)
    return NextResponse.json(apiSuccess(role))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = requirePermission(PERMISSIONS.TEAM_MANAGE)(async (_request, { auth, params }) => {
  try {
    const { roleId } = await params
    const result = await deleteCustomRole(auth.tenantId, roleId)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

import type { TenantPlan, UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  type Permission,
} from '@/lib/auth/permissions'
import {
  BUILTIN_ROLES,
  CATEGORY_ORDER,
  expandCategoryMatrix,
  isBuiltinRoleId,
  matrixFromPermissions,
  resolveRolePermissions,
} from '@/lib/settings/permissionCategories'
import { ROLE_LABELS } from '@/lib/settings/roleDefinitions'
import { parseTenantSettings } from './types'

export interface RoleUsageDTO {
  role: UserRole
  label: string
  memberCount: number
}

export interface CustomRoleDTO {
  id: string
  name: string
  description: string | null
  permissions: Permission[]
  memberCount: number
  categoryMatrix: Record<string, boolean>
}

export interface RolesPageDTO {
  plan: TenantPlan
  canCustomRoles: boolean
  categories: string[]
  builtinRoles: UserRole[]
  matrix: Record<UserRole, Record<string, boolean>>
  permissions: Record<UserRole, Permission[]>
  roleUsage: RoleUsageDTO[]
  customRoles: CustomRoleDTO[]
}

async function readRoleOverrides(tenantId: string): Promise<Partial<Record<UserRole, Permission[]>>> {
  const rows = await prisma.$queryRaw<Array<{ settings: unknown }>>`
    SELECT "settings" FROM "tenants" WHERE "id" = ${tenantId} LIMIT 1
  `
  const settings = parseTenantSettings(rows[0]?.settings) as {
    rolePermissionOverrides?: Partial<Record<UserRole, Permission[]>>
  }
  return settings.rolePermissionOverrides ?? {}
}

async function writeRoleOverrides(
  tenantId: string,
  overrides: Partial<Record<UserRole, Permission[]>>,
) {
  const rows = await prisma.$queryRaw<Array<{ settings: unknown }>>`
    SELECT "settings" FROM "tenants" WHERE "id" = ${tenantId} LIMIT 1
  `
  const existing = parseTenantSettings(rows[0]?.settings)
  const merged = { ...existing, rolePermissionOverrides: overrides }
  const payload = JSON.stringify(merged)
  await prisma.$executeRaw`
    UPDATE "tenants"
    SET "settings" = ${payload}::jsonb,
        "updatedAt" = NOW()
    WHERE "id" = ${tenantId}
  `
}

export async function getRolesPageData(tenantId: string): Promise<RolesPageDTO> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
  const overrides = await readRoleOverrides(tenantId)

  const [users, customRoles] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { role: true, customRoleId: true },
    }),
    prisma.customRole.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    }),
  ])

  const roleUsage: RoleUsageDTO[] = BUILTIN_ROLES.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    memberCount: users.filter((u) => u.role === role && !u.customRoleId).length,
  }))

  const permissions = Object.fromEntries(
    BUILTIN_ROLES.map((role) => [role, resolveRolePermissions(role, overrides)]),
  ) as Record<UserRole, Permission[]>

  const matrix = Object.fromEntries(
    BUILTIN_ROLES.map((role) => [role, matrixFromPermissions(permissions[role])]),
  ) as Record<UserRole, Record<string, boolean>>

  const customRoleDTOs: CustomRoleDTO[] = customRoles.map((cr) => {
    const perms = (cr.permissions as Permission[]) ?? []
    return {
      id: cr.id,
      name: cr.name,
      description: cr.description,
      permissions: perms,
      memberCount: users.filter((u) => u.customRoleId === cr.id).length,
      categoryMatrix: matrixFromPermissions(perms),
    }
  })

  return {
    plan: tenant.plan,
    canCustomRoles: tenant.plan !== 'STARTER',
    categories: CATEGORY_ORDER,
    builtinRoles: BUILTIN_ROLES,
    matrix,
    permissions,
    roleUsage,
    customRoles: customRoleDTOs,
  }
}

export async function updateBuiltinRolePermissions(
  tenantId: string,
  role: UserRole,
  categories: Record<string, boolean>,
) {
  if (role === 'OWNER') {
    throw new Error('Owner permissions cannot be modified')
  }

  const overrides = await readRoleOverrides(tenantId)
  const perms = expandCategoryMatrix(categories)
  if (perms.length === 0) {
    throw new Error('Role must have at least one permission category enabled')
  }

  overrides[role] = perms
  await writeRoleOverrides(tenantId, overrides)

  return { role, permissions: perms, categoryMatrix: matrixFromPermissions(perms) }
}

export async function updateCustomRolePermissions(
  tenantId: string,
  roleId: string,
  categories: Record<string, boolean>,
) {
  const role = await prisma.customRole.findFirst({ where: { id: roleId, tenantId } })
  if (!role) throw new Error('Custom role not found')

  const perms = expandCategoryMatrix(categories)
  if (perms.length === 0) {
    throw new Error('Role must have at least one permission category enabled')
  }

  const updated = await prisma.customRole.update({
    where: { id: roleId },
    data: { permissions: perms },
  })

  const users = await prisma.user.findMany({
    where: { tenantId, customRoleId: roleId },
    select: { id: true },
  })

  return {
    id: updated.id,
    permissions: perms,
    categoryMatrix: matrixFromPermissions(perms),
    invalidatedUsers: users.map((u) => u.id),
  }
}

export async function createCustomRole(
  tenantId: string,
  data: {
    name: string
    description?: string
    inheritFrom?: UserRole | string
    categories?: Record<string, boolean>
  },
) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
  if (tenant.plan === 'STARTER') {
    throw new Error('Custom roles require Professional plan or above')
  }

  let perms: Permission[] = []
  if (data.categories) {
    perms = expandCategoryMatrix(data.categories)
  } else if (data.inheritFrom && isBuiltinRoleId(data.inheritFrom)) {
    perms = [...ROLE_PERMISSIONS[data.inheritFrom]]
  } else if (data.inheritFrom) {
    const parent = await prisma.customRole.findFirst({
      where: { id: data.inheritFrom, tenantId },
    })
    if (parent) perms = (parent.permissions as Permission[]) ?? []
  }

  if (perms.length === 0) {
    perms = [...ROLE_PERMISSIONS.EMPLOYEE]
  }

  const role = await prisma.customRole.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description ?? null,
      permissions: perms,
    },
  })

  return {
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: perms,
    memberCount: 0,
    categoryMatrix: matrixFromPermissions(perms),
  }
}

export async function updateCustomRole(
  tenantId: string,
  roleId: string,
  data: { name?: string; description?: string },
) {
  const existing = await prisma.customRole.findFirst({ where: { id: roleId, tenantId } })
  if (!existing) throw new Error('Custom role not found')

  const updated = await prisma.customRole.update({
    where: { id: roleId },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
  })

  const memberCount = await prisma.user.count({
    where: { tenantId, customRoleId: roleId, isActive: true },
  })

  const perms = (updated.permissions as Permission[]) ?? []
  return {
    id: updated.id,
    name: updated.name,
    description: updated.description,
    permissions: perms,
    memberCount,
    categoryMatrix: matrixFromPermissions(perms),
  }
}

export async function deleteCustomRole(tenantId: string, roleId: string) {
  const existing = await prisma.customRole.findFirst({ where: { id: roleId, tenantId } })
  if (!existing) throw new Error('Custom role not found')

  const assigned = await prisma.user.count({ where: { tenantId, customRoleId: roleId } })
  if (assigned > 0) {
    throw new Error('Reassign members before deleting this custom role')
  }

  await prisma.customRole.delete({ where: { id: roleId } })
  return { deleted: true }
}

export function permissionsFromCategoriesOrPermissions(
  categories?: Record<string, boolean>,
  permissions?: Permission[],
): Permission[] {
  if (categories) return expandCategoryMatrix(categories)
  if (permissions?.length) return permissions.filter((p) => ALL_PERMISSIONS.includes(p))
  return []
}

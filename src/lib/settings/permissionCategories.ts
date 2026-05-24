import type { UserRole } from '@prisma/client'
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  type Permission,
  ALL_PERMISSIONS,
} from '@/lib/auth/permissions'

export const PERMISSION_CATEGORIES: Record<string, Permission[]> = {
  Knowledge: [
    PERMISSIONS.KNOWLEDGE_READ,
    PERMISSIONS.KNOWLEDGE_WRITE,
    PERMISSIONS.KNOWLEDGE_DELETE,
  ],
  Analytics: [
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.PREDICTIONS_VIEW,
  ],
  Workflows: [
    PERMISSIONS.WORKFLOWS_VIEW,
    PERMISSIONS.WORKFLOWS_CREATE,
    PERMISSIONS.WORKFLOWS_EXECUTE,
    PERMISSIONS.WORKFLOWS_DELETE,
  ],
  Agents: [PERMISSIONS.AGENTS_USE, PERMISSIONS.AGENTS_CONFIGURE],
  Finance: [PERMISSIONS.BILLING_MANAGE],
  HR: [PERMISSIONS.TEAM_MANAGE],
  Admin: [
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AUDIT_EXPORT,
    PERMISSIONS.API_KEYS_MANAGE,
    PERMISSIONS.ADMIN_IMPERSONATE,
  ],
}

export const CATEGORY_ORDER = Object.keys(PERMISSION_CATEGORIES)

export const BUILTIN_ROLES: UserRole[] = [
  'OWNER',
  'CEO',
  'MANAGER',
  'FINANCE_OFFICER',
  'SALES_OFFICER',
  'EMPLOYEE',
]

export function permissionsForCategory(category: string): Permission[] {
  return PERMISSION_CATEGORIES[category] ?? []
}

export function categoryHasAllPermissions(
  category: string,
  granted: Permission[],
): boolean {
  const perms = permissionsForCategory(category)
  return perms.length > 0 && perms.every((p) => granted.includes(p))
}

export function toggleCategoryPermissions(
  category: string,
  granted: Permission[],
  enabled: boolean,
): Permission[] {
  const perms = permissionsForCategory(category)
  if (enabled) {
    return [...new Set([...granted, ...perms])]
  }
  return granted.filter((p) => !perms.includes(p))
}

export function matrixFromPermissions(
  granted: Permission[],
): Record<string, boolean> {
  return Object.fromEntries(
    CATEGORY_ORDER.map((cat) => [cat, categoryHasAllPermissions(cat, granted)]),
  )
}

export function expandCategoryMatrix(
  categories: Record<string, boolean>,
): Permission[] {
  const result = new Set<Permission>()
  for (const [cat, enabled] of Object.entries(categories)) {
    if (!enabled) continue
    for (const p of permissionsForCategory(cat)) {
      result.add(p)
    }
  }
  return [...result]
}

export function resolveRolePermissions(
  role: UserRole,
  overrides?: Partial<Record<UserRole, Permission[]>>,
): Permission[] {
  if (role === 'OWNER') return ALL_PERMISSIONS
  const base = ROLE_PERMISSIONS[role] ?? []
  const override = overrides?.[role]
  return override ?? base
}

export function isBuiltinRoleId(roleId: string): roleId is UserRole {
  return BUILTIN_ROLES.includes(roleId as UserRole)
}

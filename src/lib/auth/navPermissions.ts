import { PERMISSIONS, type Permission } from '@/lib/auth/permissions'

/** Path prefix → permission required to view the page (null = always allowed when signed in). */
export const ROUTE_ACCESS: Array<{ prefix: string; permission: Permission | null }> = [
  { prefix: '/dashboard', permission: null },
  { prefix: '/inventory', permission: PERMISSIONS.INVENTORY_VIEW },
  { prefix: '/crm', permission: PERMISSIONS.CRM_VIEW },
  { prefix: '/sales', permission: PERMISSIONS.SALES_VIEW },
  { prefix: '/finance', permission: PERMISSIONS.FINANCE_VIEW },
  { prefix: '/assistant', permission: PERMISSIONS.AGENTS_USE },
  { prefix: '/agents', permission: PERMISSIONS.AGENTS_USE },
  { prefix: '/knowledge', permission: PERMISSIONS.KNOWLEDGE_READ },
  { prefix: '/analytics', permission: PERMISSIONS.ANALYTICS_VIEW },
  { prefix: '/predictions', permission: PERMISSIONS.PREDICTIONS_VIEW },
  { prefix: '/workflows', permission: PERMISSIONS.WORKFLOWS_VIEW },
  { prefix: '/hr', permission: PERMISSIONS.HR_VIEW },
  { prefix: '/notifications', permission: PERMISSIONS.PREDICTIONS_VIEW },
  { prefix: '/alerts', permission: PERMISSIONS.PREDICTIONS_VIEW },
  { prefix: '/settings/billing', permission: PERMISSIONS.BILLING_MANAGE },
  { prefix: '/settings/team', permission: PERMISSIONS.TEAM_MANAGE },
  { prefix: '/settings/roles', permission: PERMISSIONS.TEAM_MANAGE },
  { prefix: '/settings/api-keys', permission: PERMISSIONS.API_KEYS_MANAGE },
  { prefix: '/settings/webhooks', permission: PERMISSIONS.SETTINGS_MANAGE },
  { prefix: '/settings/channels', permission: PERMISSIONS.SETTINGS_MANAGE },
  { prefix: '/settings/general', permission: PERMISSIONS.SETTINGS_MANAGE },
  { prefix: '/settings/audit', permission: PERMISSIONS.AUDIT_VIEW },
  // Account self-service — available to every signed-in role
  { prefix: '/settings/profile', permission: null },
  { prefix: '/settings/security', permission: null },
  { prefix: '/settings/notifications', permission: null },
  { prefix: '/settings', permission: null },
]

export function permissionForPath(pathname: string): Permission | null | undefined {
  const path = pathname.split('?')[0]?.split('#')[0] ?? pathname
  let best: { prefix: string; permission: Permission | null } | undefined
  for (const rule of ROUTE_ACCESS) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
      if (!best || rule.prefix.length > best.prefix.length) best = rule
    }
  }
  return best?.permission
}

export function canAccessPath(
  pathname: string,
  hasPermission: (permission: string) => boolean,
): boolean {
  const required = permissionForPath(pathname)
  if (required === undefined) return true
  if (required === null) return true
  return hasPermission(required)
}

export function firstAllowedPath(
  hasPermission: (permission: string) => boolean,
  fallback = '/dashboard',
): string {
  const candidates = [
    '/dashboard',
    '/assistant',
    '/knowledge',
    '/analytics',
    '/predictions',
    '/workflows',
    '/notifications',
    '/settings/profile',
  ]
  for (const href of candidates) {
    if (canAccessPath(href, hasPermission)) return href
  }
  return fallback
}

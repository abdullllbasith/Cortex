import { PERMISSIONS, type Permission } from '@/lib/auth/permissions'
import type { AgentTypeKey } from '@/lib/agents/core/types'
import type { ErpModule } from '@/lib/assistant/erpContext'

/** View permission required to load each ERP module into AI context / tools. */
export const ERP_MODULE_VIEW_PERMISSION: Record<ErpModule, Permission> = {
  inventory: PERMISSIONS.INVENTORY_VIEW,
  crm: PERMISSIONS.CRM_VIEW,
  sales: PERMISSIONS.SALES_VIEW,
  finance: PERMISSIONS.FINANCE_VIEW,
  hr: PERMISSIONS.HR_VIEW,
}

/** Permissions required to run each specialist agent (AGENTS_USE alone is not enough). */
export const AGENT_TYPE_REQUIRED_PERMISSIONS: Record<AgentTypeKey, Permission[]> = {
  finance: [PERMISSIONS.FINANCE_VIEW],
  sales: [PERMISSIONS.CRM_VIEW],
  inventory: [PERMISSIONS.INVENTORY_VIEW],
  operations: [PERMISSIONS.HR_VIEW],
  /** May start; cross-module tools must still filter by module permissions. */
  executive: [PERMISSIONS.AGENTS_USE],
}

/** Write/manage permission for assistant confirmed actions by module prefix. */
export const ACTION_MODULE_MANAGE_PERMISSION: Record<string, Permission> = {
  inventory: PERMISSIONS.INVENTORY_MANAGE,
  crm: PERMISSIONS.CRM_MANAGE,
  sales: PERMISSIONS.SALES_MANAGE,
  finance: PERMISSIONS.FINANCE_MANAGE,
  hr: PERMISSIONS.HR_MANAGE,
}

export function hasAiPermission(permissions: string[], required: Permission): boolean {
  if (permissions.includes('*')) return true
  return permissions.includes(required)
}

export function hasAllAiPermissions(permissions: string[], required: readonly string[]): boolean {
  if (permissions.includes('*')) return true
  return required.every((p) => permissions.includes(p))
}

export function filterErpModulesByPermissions(
  modules: ErpModule[],
  permissions: string[],
): ErpModule[] {
  return modules.filter((m) =>
    hasAiPermission(permissions, ERP_MODULE_VIEW_PERMISSION[m]),
  )
}

export function deniedErpModules(
  modules: ErpModule[],
  permissions: string[],
): ErpModule[] {
  return modules.filter(
    (m) => !hasAiPermission(permissions, ERP_MODULE_VIEW_PERMISSION[m]),
  )
}

export function canUseAgentType(
  permissions: string[],
  agentType: AgentTypeKey,
): boolean {
  return hasAllAiPermissions(permissions, AGENT_TYPE_REQUIRED_PERMISSIONS[agentType])
}

export function permissionFingerprint(permissions: string[]): string {
  if (permissions.includes('*')) return '*'
  return [...permissions].sort().join('|')
}

/** Drop knowledge hits the user is not allowed to see (e.g. customer entities). */
export function filterKnowledgeByPermissions<
  T extends { entityType: string },
>(results: T[], permissions: string[]): T[] {
  return results.filter((r) => {
    if (r.entityType === 'customer') {
      return hasAiPermission(permissions, PERMISSIONS.CRM_VIEW)
    }
    if (r.entityType === 'product') {
      return hasAiPermission(permissions, PERMISSIONS.INVENTORY_VIEW)
    }
    if (r.entityType === 'supplier') {
      return hasAiPermission(permissions, PERMISSIONS.INVENTORY_VIEW)
    }
    // Generic knowledge docs — anyone with assistant access may see (KNOWLEDGE_READ)
    return (
      hasAiPermission(permissions, PERMISSIONS.KNOWLEDGE_READ) ||
      hasAiPermission(permissions, PERMISSIONS.AGENTS_USE)
    )
  })
}

export function permissionForAssistantActionType(actionType: string): Permission | null {
  const moduleKey = actionType.split('.')[0]
  if (!moduleKey) return null
  if (moduleKey === 'access' || moduleKey === 'automation') return null
  return ACTION_MODULE_MANAGE_PERMISSION[moduleKey] ?? null
}

export function viewPermissionForAssistantActionType(actionType: string): Permission | null {
  const moduleKey = actionType.split('.')[0]
  if (!moduleKey) return null
  const map: Record<string, Permission> = {
    inventory: PERMISSIONS.INVENTORY_VIEW,
    crm: PERMISSIONS.CRM_VIEW,
    sales: PERMISSIONS.SALES_VIEW,
    finance: PERMISSIONS.FINANCE_VIEW,
    hr: PERMISSIONS.HR_VIEW,
  }
  return map[moduleKey] ?? null
}

export function accessDeniedAction(moduleLabel: string): {
  id: string
  type: 'access.denied'
  description: string
  status: 'failed'
} {
  return {
    id: `access_denied_${Date.now()}`,
    type: 'access.denied',
    description: `Access denied: you do not have permission to view ${moduleLabel} data.`,
    status: 'failed',
  }
}

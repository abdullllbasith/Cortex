import { PERMISSIONS } from '@/lib/auth/permissions'
import {
  canUseAgentType,
  deniedErpModules,
  filterErpModulesByPermissions,
  filterKnowledgeByPermissions,
  hasAiPermission,
  permissionForAssistantActionType,
  permissionFingerprint,
} from '@/lib/auth/aiAccess'

const FINANCE_PERMS = [
  PERMISSIONS.KNOWLEDGE_READ,
  PERMISSIONS.ANALYTICS_VIEW,
  PERMISSIONS.PREDICTIONS_VIEW,
  PERMISSIONS.WORKFLOWS_VIEW,
  PERMISSIONS.AGENTS_USE,
  PERMISSIONS.ANALYTICS_EXPORT,
  PERMISSIONS.BILLING_MANAGE,
  PERMISSIONS.FINANCE_VIEW,
  PERMISSIONS.FINANCE_MANAGE,
]

describe('aiAccess RBAC', () => {
  it('finance role cannot view CRM or sales modules', () => {
    const detected = ['crm', 'sales', 'finance'] as const
    const allowed = filterErpModulesByPermissions([...detected], FINANCE_PERMS)
    const denied = deniedErpModules([...detected], FINANCE_PERMS)

    expect(allowed).toEqual(['finance'])
    expect(denied).toEqual(['crm', 'sales'])
    expect(hasAiPermission(FINANCE_PERMS, PERMISSIONS.CRM_VIEW)).toBe(false)
  })

  it('star permission unlocks all modules', () => {
    const allowed = filterErpModulesByPermissions(
      ['crm', 'inventory', 'hr'],
      ['*'],
    )
    expect(allowed).toEqual(['crm', 'inventory', 'hr'])
  })

  it('finance can use finance/executive agents but not sales', () => {
    expect(canUseAgentType(FINANCE_PERMS, 'finance')).toBe(true)
    expect(canUseAgentType(FINANCE_PERMS, 'executive')).toBe(true)
    expect(canUseAgentType(FINANCE_PERMS, 'sales')).toBe(false)
    expect(canUseAgentType(FINANCE_PERMS, 'inventory')).toBe(false)
  })

  it('AGENTS_USE alone does not unlock sales/CRM agent (BaseAgent gate)', () => {
    expect(canUseAgentType([PERMISSIONS.AGENTS_USE], 'sales')).toBe(false)
    expect(
      canUseAgentType([PERMISSIONS.AGENTS_USE, PERMISSIONS.CRM_VIEW], 'sales'),
    ).toBe(true)
  })

  it('strips customer knowledge hits without CRM_VIEW', () => {
    const filtered = filterKnowledgeByPermissions(
      [
        { entityType: 'customer', id: '1' },
        { entityType: 'knowledge', id: '2' },
        { entityType: 'product', id: '3' },
      ],
      FINANCE_PERMS,
    )
    expect(filtered.map((r) => r.entityType)).toEqual(['knowledge'])
  })

  it('maps assistant action types to manage permissions', () => {
    expect(permissionForAssistantActionType('crm.log_call')).toBe(PERMISSIONS.CRM_MANAGE)
    expect(permissionForAssistantActionType('finance.record_payment')).toBe(
      PERMISSIONS.FINANCE_MANAGE,
    )
    expect(permissionForAssistantActionType('access.denied')).toBeNull()
  })

  it('fingerprints permissions for cache isolation', () => {
    expect(permissionFingerprint(['*'])).toBe('*')
    expect(permissionFingerprint([PERMISSIONS.CRM_VIEW, PERMISSIONS.FINANCE_VIEW])).toBe(
      permissionFingerprint([PERMISSIONS.FINANCE_VIEW, PERMISSIONS.CRM_VIEW]),
    )
  })
})

import type { UserRole } from '@prisma/client'

export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: 'Owner',
  CEO: 'CEO',
  MANAGER: 'Manager',
  FINANCE_OFFICER: 'Finance Officer',
  SALES_OFFICER: 'Sales Officer',
  EMPLOYEE: 'Employee',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  OWNER: 'Full workspace control including billing, security, and all modules.',
  CEO: 'Executive access to all modules except platform impersonation.',
  MANAGER: 'Manage team members, knowledge, and workflow execution.',
  FINANCE_OFFICER: 'Billing, exports, and financial analytics access.',
  SALES_OFFICER: 'Customer knowledge, agents, and sales workflow tools.',
  EMPLOYEE: 'Read-only access to knowledge, analytics, and assigned workflows.',
}

export const ROLE_KEY_PERMISSIONS: Record<UserRole, string[]> = {
  OWNER: ['All permissions', 'Billing & admin', 'Team management'],
  CEO: ['All modules', 'Analytics export', 'Settings'],
  MANAGER: ['Team management', 'Workflows', 'Knowledge write'],
  FINANCE_OFFICER: ['Billing', 'Analytics export', 'Reports'],
  SALES_OFFICER: ['Agents', 'Knowledge write', 'Workflows execute'],
  EMPLOYEE: ['Knowledge read', 'Analytics view', 'Agents use'],
}

export const INVITABLE_ROLES: UserRole[] = [
  'CEO',
  'MANAGER',
  'FINANCE_OFFICER',
  'SALES_OFFICER',
  'EMPLOYEE',
]

export function roleBadgeVariant(
  role: UserRole,
): 'default' | 'success' | 'warning' | 'danger' | 'outline' {
  switch (role) {
    case 'OWNER':
      return 'danger'
    case 'CEO':
      return 'warning'
    case 'MANAGER':
      return 'success'
    default:
      return 'outline'
  }
}

export function formatLastActive(lastLoginAt: Date | string | null | undefined): string {
  if (!lastLoginAt) return 'Never'
  const date = typeof lastLoginAt === 'string' ? new Date(lastLoginAt) : lastLoginAt
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

export function memberStatus(isActive: boolean): 'Active' | 'Suspended' {
  return isActive ? 'Active' : 'Suspended'
}

export const DEFAULT_INVITE_MESSAGE =
  "You've been invited to join our workspace on Cortex. Click the link below to accept your invitation and set up your account."

export function buildInviteEmailPreview(opts: {
  tenantName: string
  inviterName: string
  roleLabel: string
  customMessage?: string
  inviteUrl: string
}): string {
  const body = opts.customMessage?.trim() || DEFAULT_INVITE_MESSAGE
  return `Subject: Join ${opts.tenantName} on Cortex

Hi,

${body}

Role: ${opts.roleLabel}
Invited by: ${opts.inviterName}

Accept invitation: ${opts.inviteUrl}

This link expires in 48 hours.

— Cortex`
}

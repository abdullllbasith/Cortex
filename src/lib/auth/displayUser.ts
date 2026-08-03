import type { UserRole } from '@prisma/client'
import { ROLE_LABELS } from '@/lib/settings/roleDefinitions'

export function formatUserRole(role: string | undefined): string {
  if (!role) return 'User'
  const normalized = role.toUpperCase().replace(/-/g, '_') as UserRole
  return ROLE_LABELS[normalized] ?? role.charAt(0).toUpperCase() + role.slice(1)
}

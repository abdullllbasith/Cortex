import type { TenantPlan } from '@prisma/client'
import { parseTenantSettings } from '@/lib/settings/types'

export type TenantAdminStatus = 'active' | 'trial' | 'suspended' | 'churned'

export interface TenantQuotaOverrides {
  aiCalls?: number
  workflows?: number
  storageGb?: number
  apiCalls?: number
  teamMembers?: number
}

export interface TenantAdminSettings {
  status?: TenantAdminStatus
  suspendReason?: string
  suspendedAt?: string
  planOverrideNote?: string
  quotaOverrides?: TenantQuotaOverrides
  adminNotes?: Array<{ at: string; by: string; note: string }>
  exportRequests?: Array<{
    id: string
    requestedAt: string
    requestedBy: string
    status: 'queued' | 'processing' | 'completed' | 'failed'
    downloadUrl?: string
  }>
}

export interface TenantSettingsExtended {
  admin?: TenantAdminSettings
}

const TRIAL_DAYS = 14

export function parseAdminSettings(raw: unknown): TenantAdminSettings {
  const settings = parseTenantSettings(raw) as TenantSettingsExtended & Record<string, unknown>
  if (settings.admin && typeof settings.admin === 'object') {
    return settings.admin as TenantAdminSettings
  }
  const legacyStatus = settings.status
  if (typeof legacyStatus === 'string') {
    return { status: legacyStatus as TenantAdminStatus }
  }
  return {}
}

export function resolveTenantStatus(
  admin: TenantAdminSettings,
  createdAt: Date,
  plan: TenantPlan,
): TenantAdminStatus {
  if (admin.status) return admin.status
  const trialCutoff = new Date()
  trialCutoff.setDate(trialCutoff.getDate() - TRIAL_DAYS)
  if (createdAt >= trialCutoff && plan === 'STARTER') return 'trial'
  return 'active'
}

export function mergeAdminSettings(
  existing: unknown,
  patch: Partial<TenantAdminSettings>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' ? (existing as Record<string, unknown>) : {}
  const currentAdmin = parseAdminSettings(existing)
  return {
    ...base,
    admin: { ...currentAdmin, ...patch },
    status: patch.status ?? currentAdmin.status ?? base.status,
  }
}

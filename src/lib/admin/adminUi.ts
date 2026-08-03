import type { TenantPlan } from '@prisma/client'
import type { TenantAdminStatus } from '@/lib/admin/tenantSettingsAdmin'
import { PLAN_LIMITS } from '@/lib/settings/billingPlans'

export const PLAN_LABELS: Record<TenantPlan, string> = {
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  ENTERPRISE: 'Enterprise',
}

export const PLAN_BADGE: Record<TenantPlan, 'outline' | 'default' | 'success' | 'warning'> = {
  STARTER: 'outline',
  PROFESSIONAL: 'default',
  ENTERPRISE: 'success',
}

export const STATUS_BADGE: Record<
  TenantAdminStatus,
  'success' | 'warning' | 'danger' | 'outline'
> = {
  active: 'success',
  trial: 'warning',
  suspended: 'danger',
  churned: 'outline',
}

export const PLAN_CHART_COLORS: Record<TenantPlan, string> = {
  STARTER: '#94a3b8',
  PROFESSIONAL: '#6366f1',
  ENTERPRISE: '#10b981',
}

export function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

export function aiCallsPercent(plan: TenantPlan, aiCalls: number): number {
  return usagePercent(aiCalls, PLAN_LIMITS[plan].aiCalls)
}

export function storagePercent(plan: TenantPlan, storageUsedMB: number): number {
  const limitMb = PLAN_LIMITS[plan].storageGb * 1024
  return usagePercent(storageUsedMB, limitMb)
}

export function formatCurrency(n: number): string {
  return `$${n.toLocaleString()}`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

import { getAdminSessionSnapshot } from '@/store/adminSessionStore'

export async function adminFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ success: boolean; data?: T; error?: { message: string } }> {
  const adminToken = getAdminSessionSnapshot().accessToken
  const res = await fetch(`/api/admin/${path.replace(/^\//, '')}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      ...init?.headers,
    },
    ...init,
  })
  return res.json()
}

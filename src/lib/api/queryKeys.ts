import type { ListParams } from './types'

/* ─────────────────────────────────────────────────────────────────────────────
   Centralized SWR key factory
   Prevents collisions and enables targeted cache invalidation.
   ───────────────────────────────────────────────────────────────────────────── */

function serializeFilters(filters?: Record<string, unknown>): string {
  if (!filters) return ''
  const entries = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : ''
}

export const queryKeys = {
  customers: {
    all: ['customers'] as const,
    lists: () => [...queryKeys.customers.all, 'list'] as const,
    list: (tenantId: string, params?: ListParams) =>
      [...queryKeys.customers.lists(), tenantId, serializeFilters(params)] as const,
    details: () => [...queryKeys.customers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.customers.details(), id] as const,
  },

  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (tenantId: string, params?: ListParams) =>
      [...queryKeys.products.lists(), tenantId, serializeFilters(params)] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.products.details(), id] as const,
  },

  suppliers: {
    all: ['suppliers'] as const,
    lists: () => [...queryKeys.suppliers.all, 'list'] as const,
    list: (tenantId: string, params?: ListParams) =>
      [...queryKeys.suppliers.lists(), tenantId, serializeFilters(params)] as const,
    details: () => [...queryKeys.suppliers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.suppliers.details(), id] as const,
  },

  analytics: {
    all: ['analytics'] as const,
    detail: (type: string, period: string) =>
      [...queryKeys.analytics.all, type, period] as const,
  },

  predictions: {
    all: ['predictions'] as const,
    detail: (type: string) => [...queryKeys.predictions.all, type] as const,
  },

  agents: {
    all: ['agents'] as const,
    list: () => [...queryKeys.agents.all, 'list'] as const,
    logs: (agentType: string, params?: ListParams) =>
      [...queryKeys.agents.all, 'logs', agentType, serializeFilters(params)] as const,
  },

  workflows: {
    all: ['workflows'] as const,
    lists: () => [...queryKeys.workflows.all, 'list'] as const,
    list: () => [...queryKeys.workflows.lists()] as const,
    details: () => [...queryKeys.workflows.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.workflows.details(), id] as const,
    executions: (id: string) =>
      [...queryKeys.workflows.all, 'executions', id] as const,
  },

  alerts: {
    all: ['alerts'] as const,
    list: (unreadOnly?: boolean) =>
      [...queryKeys.alerts.all, unreadOnly ? 'unread' : 'all'] as const,
  },

  session: {
    user:   ['session', 'user']   as const,
    tenant: ['session', 'tenant'] as const,
    team:   ['session', 'team']   as const,
  },
} as const

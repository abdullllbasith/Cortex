'use client'

import useSWR from 'swr'
import { getSessionSnapshot } from '@/store/sessionStore'
import type { AnalyticsPeriod } from '@/lib/analytics/periodUtils'
import type {
  ExecutiveAnalyticsData,
  SalesAnalyticsData,
  CustomerAnalyticsData,
  InventoryAnalyticsData,
  SupplierAnalyticsData,
  FinanceAnalyticsData,
  HrAnalyticsData,
} from '@/lib/analytics/types'
import { analyticsPollIntervalMs } from '@/lib/performance/runtimeFlags'

const REFRESH_MS = analyticsPollIntervalMs()

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

async function fetchAnalytics<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const session = getSessionSnapshot()
  const base = process.env.NEXT_PUBLIC_API_URL ?? '/api'
  const search = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) search.set(k, v)
    }
  }
  const qs = search.toString()
  const url = `${base}${path}${qs ? `?${qs}` : ''}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(session.tenant?.id ? { 'x-tenant-id': session.tenant.id } : {}),
    },
  })
  if (!res.ok) throw new Error('Analytics request failed')
  const json = await res.json() as ApiEnvelope<T>
  return json.data
}

export interface AnalyticsQueryParams {
  period?: AnalyticsPeriod
  startDate?: string
  endDate?: string
  granularity?: 'hour' | 'day' | 'week' | 'month'
}

function queryKey(endpoint: string, params?: AnalyticsQueryParams) {
  return ['analytics', endpoint, params?.period ?? 'month', params?.startDate, params?.endDate, params?.granularity]
}

export function useExecutiveAnalytics(params?: AnalyticsQueryParams) {
  return useSWR<ExecutiveAnalyticsData>(
    queryKey('executive', params),
    () => fetchAnalytics('/analytics/executive', {
      period: params?.period,
      startDate: params?.startDate,
      endDate: params?.endDate,
      format: 'analytics',
    }),
    { refreshInterval: REFRESH_MS },
  )
}

export function useSalesAnalytics(params?: AnalyticsQueryParams) {
  return useSWR<SalesAnalyticsData>(
    queryKey('sales', params),
    () => fetchAnalytics('/analytics/sales', {
      period: params?.period,
      startDate: params?.startDate,
      endDate: params?.endDate,
      granularity: params?.granularity ?? 'day',
    }),
    { refreshInterval: REFRESH_MS },
  )
}

export function useCustomerAnalytics(params?: AnalyticsQueryParams) {
  return useSWR<CustomerAnalyticsData>(
    queryKey('customers', params),
    () => fetchAnalytics('/analytics/customers', {
      period: params?.period,
      startDate: params?.startDate,
      endDate: params?.endDate,
    }),
    { refreshInterval: REFRESH_MS },
  )
}

export function useInventoryAnalytics(params?: Pick<AnalyticsQueryParams, 'period' | 'startDate' | 'endDate'>) {
  return useSWR<InventoryAnalyticsData>(
    queryKey('inventory', params),
    () => fetchAnalytics('/analytics/inventory', {
      period: params?.period,
      startDate: params?.startDate,
      endDate: params?.endDate,
    }),
    { refreshInterval: REFRESH_MS },
  )
}

export interface FinanceModuleSummary {
  monthlyRevenue: number
  monthlyExpenses: number
  netProfit: number
  grossMargin: number
  arTotal: number
  apTotal: number
  cashBalance: number
  details?: FinanceAnalyticsData
}

export interface HrModuleSummary {
  totalEmployees: number
  onLeaveToday: number
  attendanceRateThisMonth: number
  pendingLeaveRequests: number
  nextPayrollDate: string
  totalPayrollCost: number
  details?: HrAnalyticsData
}

export interface CrmModuleSummary {
  totalContacts: number
  openDeals: number
  pipelineValue: number
  wonThisMonth: number
  conversionRate: number
  avgDealSize: number
  overdueFollowUps: number
  details?: Record<string, unknown>
}

export function useFinanceAnalytics(params?: AnalyticsQueryParams) {
  return useSWR<FinanceModuleSummary>(
    queryKey('finance', params),
    () => fetchAnalytics('/analytics/finance', {
      period: params?.period,
      startDate: params?.startDate,
      endDate: params?.endDate,
      details: 'true',
    }),
    { refreshInterval: REFRESH_MS },
  )
}

export function useHrAnalytics(params?: AnalyticsQueryParams) {
  return useSWR<HrModuleSummary>(
    queryKey('hr', params),
    () => fetchAnalytics('/analytics/hr', {
      period: params?.period,
      startDate: params?.startDate,
      endDate: params?.endDate,
      details: 'true',
    }),
    { refreshInterval: REFRESH_MS },
  )
}

export function useCrmAnalytics() {
  return useSWR<CrmModuleSummary>(
    ['analytics', 'crm'],
    () => fetchAnalytics('/analytics/crm', { details: 'true' }),
    { refreshInterval: REFRESH_MS },
  )
}

export function useSupplierAnalytics(params?: AnalyticsQueryParams) {
  return useSWR<SupplierAnalyticsData>(
    queryKey('suppliers', params),
    () => fetchAnalytics('/analytics/suppliers', {
      period: params?.period,
      startDate: params?.startDate,
      endDate: params?.endDate,
    }),
    { refreshInterval: REFRESH_MS },
  )
}

'use client'

import useSWR from 'swr'
import { apiClient, swrFetcher } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/api/queryKeys'
import type { SalesForecastPoint } from '@/lib/ml/types'
import type { ChurnRiskItem } from '@/components/predictions/ChurnRiskList'
import type { InventoryRiskItem } from '@/components/predictions/InventoryRiskTable'
import type { SupplierRiskItem } from '@/components/predictions/SupplierRiskMatrix'

export interface SalesPredictionData {
  historical: Array<{ date: string; actualRevenue: number }>
  forecast: SalesForecastPoint[]
  trendDirection?: 'up' | 'down' | 'flat'
  trendPct?: number
  seasonalPattern?: string
  anomalies?: unknown[]
  method?: string | null
}

export interface InventoryPredictionData {
  items: InventoryRiskItem[]
  purchaseOrders: Array<{
    productId: string
    productName: string
    quantity: number
    recommendedDate: string | null
    urgency: string
  }>
}

export interface CustomerPredictionData {
  items: ChurnRiskItem[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export interface SupplierPredictionData {
  items: SupplierRiskItem[]
}

export function useSalesPredictions(horizon = 30, granularity: 'daily' | 'weekly' | 'monthly' = 'daily') {
  return useSWR<SalesPredictionData>(
    [...queryKeys.predictions.detail('sales'), horizon, granularity],
    () => swrFetcher(`/predictions/sales?horizon=${horizon}&granularity=${granularity}`),
  )
}

export function useInventoryPredictions(urgency = 'all') {
  return useSWR<InventoryPredictionData>(
    [...queryKeys.predictions.detail('inventory'), urgency],
    () => swrFetcher(`/predictions/inventory?urgency=${urgency}`),
  )
}

export function useCustomerChurnPredictions(risk = 'all', page = 1) {
  return useSWR<CustomerPredictionData>(
    [...queryKeys.predictions.detail('customers'), risk, page],
    () => swrFetcher(`/predictions/customers?risk=${risk}&page=${page}`),
  )
}

export function useSupplierRiskPredictions() {
  return useSWR<SupplierPredictionData>(
    queryKeys.predictions.detail('suppliers'),
    () => swrFetcher('/predictions/suppliers'),
  )
}

export function useRefreshPredictions() {
  return {
    refresh: () => apiClient.post('/predictions/refresh'),
  }
}

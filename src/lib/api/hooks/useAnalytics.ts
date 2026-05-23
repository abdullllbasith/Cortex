'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/api/queryKeys'
import type { AnalyticsResult, PredictionResult } from '@/lib/api/types'

export function useAnalytics(type: string, period: string) {
  return useSWR<AnalyticsResult>(
    queryKeys.analytics.detail(type, period),
    () => apiClient.get<AnalyticsResult>(`/analytics/${type}`, { params: { period } }),
  )
}

export function usePredictions(type: string) {
  return useSWR<PredictionResult>(
    queryKeys.predictions.detail(type),
    () => apiClient.get<PredictionResult>(`/predictions/${type}`),
  )
}

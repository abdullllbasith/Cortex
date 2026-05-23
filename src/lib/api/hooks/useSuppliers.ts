'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/api/queryKeys'
import { useSessionStore } from '@/store/sessionStore'
import type { Supplier, ListParams, PaginatedResponse } from '@/lib/api/types'

export function useSuppliers(params?: ListParams) {
  const tenantId = useSessionStore((s) => s.tenant?.id ?? 'default')

  return useSWR<PaginatedResponse<Supplier>>(
    queryKeys.suppliers.list(tenantId, params),
    () => apiClient.get<PaginatedResponse<Supplier>>('/suppliers', { params }),
  )
}

export function useSupplier(id?: string) {
  return useSWR<Supplier>(
    id ? queryKeys.suppliers.detail(id) : null,
    () => apiClient.get<Supplier>(`/suppliers/${id}`),
  )
}

'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { apiClient } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/api/queryKeys'
import { useSessionStore } from '@/store/sessionStore'
import type { ListParams, PaginatedResponse } from '@/lib/api/types'

export interface CustomerRecord {
  id: string
  profile: Record<string, unknown>
  purchaseHistory?: unknown[]
  embeddingStatus?: string
  createdAt: string
  updatedAt: string
}

export interface CustomerCreatePayload {
  profile: {
    name: string
    email: string
    company?: string
    tier?: string
    region?: string
  }
}

export function useCustomers(params?: ListParams) {
  const tenantId = useSessionStore((s) => s.tenant?.id ?? 'default')

  return useSWR<PaginatedResponse<CustomerRecord>>(
    queryKeys.customers.list(tenantId, params),
    () => apiClient.get<PaginatedResponse<CustomerRecord>>('/customers', { params }),
  )
}

export function useCustomer(id?: string) {
  return useSWR<CustomerRecord>(
    id ? queryKeys.customers.detail(id) : null,
    () => apiClient.get<CustomerRecord>(`/customers/${id}`),
  )
}

export function useMutateCustomer() {
  const create = useSWRMutation(
    queryKeys.customers.all,
    (_key, { arg }: { arg: CustomerCreatePayload }) =>
      apiClient.post<CustomerRecord>('/customers', arg),
  )

  const update = useSWRMutation(
    queryKeys.customers.all,
    (_key, { arg }: { arg: { id: string; data: Partial<CustomerCreatePayload> & { version: number } } }) =>
      apiClient.patch<CustomerRecord>(`/customers/${arg.id}`, arg.data),
  )

  const remove = useSWRMutation(
    queryKeys.customers.all,
    (_key, { arg }: { arg: string }) =>
      apiClient.delete<void>(`/customers/${arg}`),
  )

  return { create, update, remove }
}

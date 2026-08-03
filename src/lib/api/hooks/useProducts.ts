'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { apiClient } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/api/queryKeys'
import { useSessionStore } from '@/store/sessionStore'
import type { Product, ListParams, PaginatedResponse } from '@/lib/api/types'

export function useProducts(params?: ListParams) {
  const tenantId = useSessionStore((s) => s.tenant?.id ?? 'default')

  return useSWR<PaginatedResponse<Product>>(
    queryKeys.products.list(tenantId, params),
    () => apiClient.get<PaginatedResponse<Product>>('/products', { params }),
  )
}

export function useProduct(id?: string) {
  return useSWR<Product>(
    id ? queryKeys.products.detail(id) : null,
    () => apiClient.get<Product>(`/products/${id}`),
  )
}

export function useMutateProduct() {
  const create = useSWRMutation(
    queryKeys.products.all,
    (_key, { arg }: { arg: Partial<Product> }) =>
      apiClient.post<Product>('/products', arg),
  )

  const update = useSWRMutation(
    queryKeys.products.all,
    (_key, { arg }: { arg: { id: string; data: Partial<Product> } }) =>
      apiClient.patch<Product>(`/products/${arg.id}`, arg.data),
  )

  return { create, update }
}

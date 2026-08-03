'use client'

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import useSWR from 'swr'
import { swrFetcher } from '@/lib/api/apiClient'
import { useSessionStore } from '@/store/sessionStore'
import {
  applyTenantBranding,
  BRANDING_UPDATED_EVENT,
  type TenantBranding,
} from '@/lib/branding/tenantBranding'

const TenantBrandingContext = createContext<TenantBranding>({})

export function useTenantBranding(): TenantBranding {
  return useContext(TenantBrandingContext)
}

export function TenantBrandingProvider({ children }: { children: ReactNode }) {
  const tenant = useSessionStore((s) => s.tenant)
  const devSessionSynced = useSessionStore((s) => s.devSessionSynced)
  const updateTenant = useSessionStore((s) => s.updateTenant)

  const sessionBranding = useMemo(
    () => ({
      name: tenant?.name ?? null,
      logoUrl: tenant?.logoUrl ?? null,
      primaryColor: tenant?.primaryColor ?? null,
      secondaryColor: tenant?.secondaryColor ?? null,
    }),
    [tenant],
  )

  const { data, mutate } = useSWR<TenantBranding>(
    tenant?.id && devSessionSynced ? '/settings/branding' : null,
    swrFetcher,
    { dedupingInterval: 30_000, revalidateOnFocus: true },
  )

  useEffect(() => {
    if (!data) return
    updateTenant({
      name: data.name ?? undefined,
      logoUrl: data.logoUrl ?? undefined,
      primaryColor: data.primaryColor ?? undefined,
      secondaryColor: data.secondaryColor ?? undefined,
    })
  }, [data, updateTenant])

  const branding = useMemo(
    () => ({
      name: data?.name ?? sessionBranding.name ?? null,
      logoUrl: data?.logoUrl ?? sessionBranding.logoUrl ?? null,
      primaryColor: data?.primaryColor ?? sessionBranding.primaryColor ?? null,
      secondaryColor: data?.secondaryColor ?? sessionBranding.secondaryColor ?? null,
    }),
    [data, sessionBranding],
  )

  useEffect(() => {
    applyTenantBranding(branding)
  }, [branding])

  useEffect(() => {
    const refresh = () => {
      void mutate()
    }
    window.addEventListener(BRANDING_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(BRANDING_UPDATED_EVENT, refresh)
  }, [mutate])

  return (
    <TenantBrandingContext.Provider value={branding}>
      {children}
    </TenantBrandingContext.Provider>
  )
}

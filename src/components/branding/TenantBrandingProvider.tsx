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
  const tenantId = useSessionStore((s) => s.tenant?.id)

  const { data, mutate } = useSWR<TenantBranding>(
    tenantId ? '/settings/branding' : null,
    swrFetcher,
  )

  const branding = useMemo(
    () => ({
      name: data?.name ?? null,
      logoUrl: data?.logoUrl ?? null,
      primaryColor: data?.primaryColor ?? null,
      secondaryColor: data?.secondaryColor ?? null,
    }),
    [data],
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

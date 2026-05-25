'use client'

import { useEffect, type ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import { SWRConfig } from 'swr'
import { Toaster } from '@/components/ui/Toast'
import { swrFetcher } from '@/lib/api/apiClient'
import { DevSessionBootstrap } from '@/components/auth/DevSessionBootstrap'
import { SessionProfileHydrator } from '@/components/auth/SessionProfileHydrator'
import { CookieConsentBanner } from '@/components/consent/CookieConsentBanner'
import { rehydrateSessionStore } from '@/store/sessionStore'
import { useUiStore } from '@/store/uiStore'

const isDev = process.env.NODE_ENV === 'development'

const swrConfig = {
  dedupingInterval: isDev ? 5_000 : 30_000,
  revalidateOnMount: isDev,
  revalidateOnFocus: false,
  revalidateOnReconnect: isDev,
  keepPreviousData: !isDev,
  errorRetryCount: 2,
  fetcher: swrFetcher,
}

/** Rehydrate persisted stores without blocking first paint. */
function ZustandHydration({ children }: { children: ReactNode }) {
  useEffect(() => {
    rehydrateSessionStore()
    if (!useUiStore.persist?.hasHydrated?.()) {
      void useUiStore.persist?.rehydrate?.()
    }
  }, [])

  return children
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      storageKey="saios-theme"
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      <SWRConfig value={swrConfig}>
        <ZustandHydration>
          <DevSessionBootstrap />
          <SessionProfileHydrator />
          {children}
          <CookieConsentBanner />
          <Toaster />
        </ZustandHydration>
      </SWRConfig>
    </ThemeProvider>
  )
}

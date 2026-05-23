'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import { SWRConfig } from 'swr'
import { Toaster } from '@/components/ui/Toast'
import { swrFetcher } from '@/lib/api/apiClient'
import { useSessionStore } from '@/store/sessionStore'
import { useUiStore } from '@/store/uiStore'

const swrConfig = {
  dedupingInterval: 5000,
  revalidateOnFocus: false,
  fetcher: swrFetcher,
}

function ZustandHydration({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stores = [useSessionStore, useUiStore]
    const pending = stores.filter((s) => !s.persist.hasHydrated())

    if (pending.length === 0) {
      setReady(true)
      return
    }

    const unsubs = pending.map((store) =>
      store.persist.onFinishHydration(() => {
        if (stores.every((s) => s.persist.hasHydrated())) setReady(true)
      }),
    )

    return () => unsubs.forEach((u) => u())
  }, [])

  if (!ready) return null

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
          {children}
          <Toaster />
        </ZustandHydration>
      </SWRConfig>
    </ThemeProvider>
  )
}

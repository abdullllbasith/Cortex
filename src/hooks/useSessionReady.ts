'use client'

import { useEffect, useState } from 'react'
import { hasSessionHydrated, onSessionHydrated } from '@/store/sessionStore'

/** True after persisted session state has rehydrated from localStorage. */
export function useSessionReady() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (hasSessionHydrated()) {
      setReady(true)
      return
    }
    return onSessionHydrated(() => setReady(true))
  }, [])

  return ready
}

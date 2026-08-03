'use client'

import { useEffect, useState } from 'react'

/** True when the browser tab is visible — pause polling/SSE when hidden. */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const sync = () => setVisible(document.visibilityState === 'visible')
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  return visible
}

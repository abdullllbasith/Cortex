'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import type { LogoSurface } from '@/lib/branding/logoAssets'

/** Maps theme or forced surface to logo variant (light bg → DARK png, dark bg → LIGHT png). */
export function useResolvedLogoSurface(surface: LogoSurface = 'auto'): 'light' | 'dark' {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (surface === 'light' || surface === 'dark') return surface

  if (!mounted) return 'dark'

  return resolvedTheme === 'dark' ? 'dark' : 'light'
}

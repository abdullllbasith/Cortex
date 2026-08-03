'use client'

import { useMediaQuery } from './useMediaQuery'

/** Viewport width below Tailwind `md` (< 768px). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}

/** Tablet range: `md` through below `lg` (768px–1023px). */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
}

/** Desktop and up: `lg+` (≥ 1024px). */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}

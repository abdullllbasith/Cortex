/** Logo PNGs for light/dark UI surfaces (not file color names). */
export const SAIOS_LOGO = {
  /** Dark wordmark — use on light backgrounds / light mode */
  lightSurface: '/Cortex-black.png',
  /** Light wordmark — use on dark backgrounds / dark mode */
  darkSurface: '/Cortex-white.png',
} as const

export const SOFTORA_LOGO = {
  lightSurface: '/Softora-DARK.png',
  darkSurface: '/Softora-LIGHT.png',
} as const

export const SOFTORA_FAVICON = '/Softora-favicon.png'

export type LogoSurface = 'light' | 'dark' | 'auto'

export function getSaiosLogoSrc(surface: 'light' | 'dark'): string {
  return surface === 'dark' ? SAIOS_LOGO.darkSurface : SAIOS_LOGO.lightSurface
}

export function getSoftoraLogoSrc(surface: 'light' | 'dark'): string {
  return surface === 'dark' ? SOFTORA_LOGO.darkSurface : SOFTORA_LOGO.lightSurface
}

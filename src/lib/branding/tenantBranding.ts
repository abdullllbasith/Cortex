import { SOFTORA_FAVICON } from '@/lib/branding/logoAssets'

export interface TenantBranding {
  name?: string | null
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
}

export function normalizeHex(color: string | undefined | null, fallback: string): string {
  if (!color || !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color)) return fallback
  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
  }
  return color.toLowerCase()
}

function hexToRgb(hex: string) {
  const h = normalizeHex(hex, '#4f46e5').slice(1)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
    .join('')}`
}

export function mixHex(hex: string, amount: number, target: 'white' | 'black' = 'white'): string {
  const { r, g, b } = hexToRgb(hex)
  const t = target === 'white' ? 255 : 0
  return rgbToHex(r + (t - r) * amount, g + (t - g) * amount, b + (t - b) * amount)
}

export function getReadableTextColor(hex: string): '#ffffff' | '#0f172a' {
  const { r, g, b } = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#0f172a' : '#ffffff'
}

/** Ensures user chat bubbles stay visible on light/dark page backgrounds. */
export function getChatUserBubbleBackground(hex: string): string {
  const normalized = normalizeHex(hex, '#4f46e5')
  const { r, g, b } = hexToRgb(normalized)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  if (luminance < 0.35) {
    return mixHex(normalized, 0.5, 'white')
  }
  return normalized
}

export function applyTenantBranding(branding: TenantBranding): void {
  if (typeof document === 'undefined') return

  const primary = normalizeHex(branding.primaryColor ?? undefined, '#4f46e5')
  const secondary = normalizeHex(branding.secondaryColor ?? undefined, '#0ea5e9')
  const chatUserBubble = getChatUserBubbleBackground(primary)
  const root = document.documentElement

  root.style.setProperty('--color-brand', primary)
  root.style.setProperty('--color-brand-on-primary', getReadableTextColor(primary))
  root.style.setProperty('--color-brand-hover', mixHex(primary, 0.12, 'white'))
  root.style.setProperty('--color-brand-active', mixHex(primary, 0.18, 'black'))
  root.style.setProperty('--color-brand-subtle', mixHex(primary, 0.92, 'white'))
  root.style.setProperty('--color-brand-muted', mixHex(primary, 0.84, 'white'))
  root.style.setProperty('--color-chat-user-bubble', chatUserBubble)
  root.style.setProperty('--color-chat-user-bubble-text', getReadableTextColor(chatUserBubble))
  root.style.setProperty('--focus-ring-color', mixHex(primary, 0.08, 'white'))
  root.style.setProperty('--color-accent', secondary)
  root.style.setProperty('--selection-bg', mixHex(primary, 0.88, 'white'))

  applyTenantFavicon(branding.logoUrl)
}

const DEFAULT_FAVICON = SOFTORA_FAVICON
const FAVICON_LINK_ID = 'saios-dynamic-favicon'
const APPLE_ICON_LINK_ID = 'saios-dynamic-apple-icon'

function faviconMimeType(href: string): string | undefined {
  const path = href.split('?')[0].split('#')[0].toLowerCase()
  if (path.endsWith('.svg')) return 'image/svg+xml'
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.gif')) return 'image/gif'
  return undefined
}

function setFaviconLink(link: HTMLLinkElement, rel: string, href: string, mime?: string): void {
  link.rel = rel
  link.href = href
  if (mime) link.type = mime
  else link.removeAttribute('type')
}

/** Use workspace logo as browser tab icon (favicon) when set. */
export function applyTenantFavicon(logoUrl: string | null | undefined): void {
  if (typeof document === 'undefined') return

  const href = logoUrl?.trim() ? logoUrl : DEFAULT_FAVICON
  const mime = faviconMimeType(href)

  const managed: Array<{ id: string; rel: string }> = [
    { id: FAVICON_LINK_ID, rel: 'icon' },
    { id: APPLE_ICON_LINK_ID, rel: 'apple-touch-icon' },
  ]

  for (const { id, rel } of managed) {
    let link = document.getElementById(id) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = id
      document.head.appendChild(link)
    }
    setFaviconLink(link, rel, href, mime)
  }

  // Sync Next.js metadata icons in place — never remove nodes React may still reference.
  document
    .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
    .forEach((node) => {
      const link = node as HTMLLinkElement
      if (link.id === FAVICON_LINK_ID || link.id === APPLE_ICON_LINK_ID) return
      setFaviconLink(link, link.rel || 'icon', href, mime)
    })
}

export const BRANDING_UPDATED_EVENT = 'saios:branding-updated'

export function notifyBrandingUpdated(patch?: Partial<TenantBranding>): void {
  if (typeof window === 'undefined') return
  if (patch?.logoUrl !== undefined) {
    applyTenantFavicon(patch.logoUrl)
  }
  window.dispatchEvent(new CustomEvent(BRANDING_UPDATED_EVENT, { detail: patch }))
}

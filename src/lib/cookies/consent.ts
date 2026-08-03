export const COOKIE_CONSENT_KEY = 'saios:cookie-consent'
export const COOKIE_CONSENT_VERSION = 1

export type CookieConsentChoice = {
  version: number
  essential: true
  analytics: boolean
  acceptedAt: string
}

export function shouldShowCookieBanner(): boolean {
  if (process.env.NEXT_PUBLIC_COOKIE_BANNER === 'false') return false
  if (process.env.NEXT_PUBLIC_COOKIE_BANNER === 'true') return true
  return process.env.NODE_ENV === 'production'
}

export function readCookieConsent(): CookieConsentChoice | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CookieConsentChoice
    if (parsed.version !== COOKIE_CONSENT_VERSION || !parsed.acceptedAt) return null
    return parsed
  } catch {
    return null
  }
}

export function saveCookieConsent(analytics = false): CookieConsentChoice {
  const choice: CookieConsentChoice = {
    version: COOKIE_CONSENT_VERSION,
    essential: true,
    analytics,
    acceptedAt: new Date().toISOString(),
  }
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(choice))
  window.dispatchEvent(new CustomEvent('saios:cookie-consent', { detail: choice }))
  return choice
}

export function hasAnalyticsConsent(): boolean {
  return readCookieConsent()?.analytics === true
}

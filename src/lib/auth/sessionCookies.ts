import type { NextResponse } from 'next/server'
import { REFRESH_COOKIE, refreshCookieMaxAge } from '@/lib/auth/jwt'

export const MFA_PENDING_COOKIE = 'saios_mfa_pending'

export function setRefreshCookie(
  response: NextResponse,
  token: string,
  rememberMe = true,
) {
  response.cookies.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: refreshCookieMaxAge(rememberMe),
  })
}

export function setMfaPendingCookie(response: NextResponse) {
  response.cookies.set(MFA_PENDING_COOKIE, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60,
  })
}

export function clearMfaPendingCookie(response: NextResponse) {
  response.cookies.delete(MFA_PENDING_COOKIE)
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.delete(REFRESH_COOKIE)
  response.cookies.delete(MFA_PENDING_COOKIE)
}

import { type NextRequest, NextResponse } from 'next/server'
import { applyEdgeRateLimit, classifyRateLimitRoute } from '@/lib/security/edgeRateLimiter'
import {
  checkIpAllowlist,
  getAdminTokenFromRequest,
  getClientIp,
  isAdminPageRoute,
  isAdminLoginRoute,
} from '@/middleware/adminAuthEdge'
import { MFA_PENDING_COOKIE } from '@/lib/auth/sessionCookies'
import { REFRESH_COOKIE } from '@/lib/auth/jwt'

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth',
  '/invite',
  '/mfa',
  '/pricing',
  '/about',
  '/legal',
]

const PUBLIC_API_PREFIXES = [
  '/api/auth',
  '/api/channels',
  '/api/workflows/webhook',
  '/api/dev',
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return true
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return true
  return false
}

function buildCorsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get('origin') ?? ''
  const allowed =
    origin.endsWith('.saios.app') ||
    origin === process.env.NEXT_PUBLIC_APP_URL ||
    origin.startsWith('http://localhost')

  return allowed && origin
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      }
    : {}
}

function securityHeaders(request: NextRequest): HeadersInit {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
  ].join('; ')

  return {
    'Content-Security-Policy': csp,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...buildCorsHeaders(request),
  }
}

function applySecurityHeaders(response: NextResponse, request: NextRequest): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders(request))) {
    response.headers.set(key, value)
  }
  return response
}

async function getSupabaseUser(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return { user: null, response }

  const { createServerClient } = await import('@supabase/ssr')
  let mutableResponse = response

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        mutableResponse = NextResponse.next({ request })
        applySecurityHeaders(mutableResponse, request)
        cookiesToSet.forEach(({ name, value, options }) =>
          mutableResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  return { user, response: mutableResponse }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: securityHeaders(request) })
  }

  const rlType = classifyRateLimitRoute(pathname)
  if (rlType) {
    const blocked = await applyEdgeRateLimit(request, rlType)
    if (blocked) return blocked
  }

  let response = NextResponse.next({ request })
  applySecurityHeaders(response, request)

  // Admin panel — IP allowlist + platform admin session
  if (isAdminPageRoute(pathname)) {
    const ip = getClientIp(request)
    if (!checkIpAllowlist(ip)) {
      return NextResponse.json(
        { success: false, error: { message: 'Admin access denied from this IP', code: 'IP_NOT_ALLOWED' } },
        { status: 403 },
      )
    }

    if (isAdminLoginRoute(pathname)) {
      return response
    }

    const { verifyAdminAccessToken } = await import('@/lib/auth/adminJwt')
    const adminToken = getAdminTokenFromRequest(request)

    if (!adminToken) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/admin/login'
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    try {
      await verifyAdminAccessToken(adminToken)
    } catch {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/admin/login'
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    return response
  }

  // Skip auth gate for API routes and dev mode
  if (pathname.startsWith('/api/')) {
    return response
  }

  if (process.env.AUTH_DEV_MODE === 'true') {
    return response
  }

  const { user, response: supabaseResponse } = await getSupabaseUser(request, response)
  response = supabaseResponse

  // App sessions use opaque refresh cookies (invite accept / password login).
  // Supabase SSR cookies are optional — do not require both.
  const hasAppSession = Boolean(request.cookies.get(REFRESH_COOKIE)?.value)
  const isAuthenticated = Boolean(user) || hasAppSession

  // Landing: redirect authenticated users to dashboard
  if (pathname === '/' && isAuthenticated) {
    const dash = request.nextUrl.clone()
    dash.pathname = '/dashboard'
    return NextResponse.redirect(dash)
  }

  // Expired client session — clear stale refresh cookie and show login
  if (pathname === '/login' && request.nextUrl.searchParams.get('expired') === '1') {
    const loginRes = NextResponse.next({ request })
    applySecurityHeaders(loginRes, request)
    loginRes.cookies.delete(REFRESH_COOKIE)
    loginRes.cookies.delete(MFA_PENDING_COOKIE)
    return loginRes
  }

  // Already signed in — leave auth pages for the app
  if (
    isAuthenticated &&
    (pathname === '/login' || pathname === '/register' || pathname.startsWith('/invite'))
  ) {
    const dash = request.nextUrl.clone()
    const redirect = request.nextUrl.searchParams.get('redirect')
    dash.pathname =
      redirect && redirect.startsWith('/') && !redirect.startsWith('//')
        ? redirect
        : '/dashboard'
    dash.search = ''
    return NextResponse.redirect(dash)
  }

  // Public routes (including marketing landing for guests)
  if (isPublicPath(pathname)) {
    return response
  }

  if (!isAuthenticated) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // MFA pending — block protected routes until verified
  const mfaPending = request.cookies.get(MFA_PENDING_COOKIE)?.value === '1'
  if (mfaPending && !pathname.startsWith('/mfa')) {
    const mfaUrl = request.nextUrl.clone()
    mfaUrl.pathname = '/mfa/verify'
    mfaUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(mfaUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

import { NextRequest, NextResponse } from 'next/server'
import { revokeSession } from '@/lib/auth/sessionService'
import { REFRESH_COOKIE } from '@/lib/auth/jwt'
import { createSupabaseServerClient } from '@/lib/auth/supabaseServer'
import { log } from '@/lib/audit/auditLogger'
import { extractRequestMeta } from '@/lib/audit/auditLogger'

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value
  const meta = extractRequestMeta(request)

  if (refreshToken) {
    await revokeSession(refreshToken)
  }

  const supabase = await createSupabaseServerClient()
  if (supabase) {
    await supabase.auth.signOut()
  }

  const response = NextResponse.json({ success: true, data: { loggedOut: true } })
  response.cookies.set(REFRESH_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })

  log({
    tenantId: request.headers.get('x-tenant-id') ?? 'unknown',
    action: 'logout',
    resourceType: 'session',
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })

  return response
}

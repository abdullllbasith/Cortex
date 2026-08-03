import { NextRequest, NextResponse } from 'next/server'
import { revokeSession } from '@/lib/auth/sessionService'
import { createSupabaseServerClient } from '@/lib/auth/supabaseServer'
import { log, extractRequestMeta } from '@/lib/audit/auditLogger'
import { clearAuthCookies } from '@/lib/auth/sessionCookies'

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('saios_refresh')?.value
    const meta = extractRequestMeta(request)

    if (refreshToken) {
      await revokeSession(refreshToken)
    }

    const supabase = await createSupabaseServerClient()
    if (supabase) {
      await supabase.auth.signOut()
    }

    const response = NextResponse.json({ success: true, data: { loggedOut: true } })
    clearAuthCookies(response)

    log({
      tenantId: request.headers.get('x-tenant-id') ?? 'unknown',
      action: 'logout',
      resourceType: 'session',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return response
  } catch (err) {
    console.error('[auth/logout]', err)
    return NextResponse.json({ success: false, error: { message: 'Logout failed' } }, { status: 500 })
  }
}

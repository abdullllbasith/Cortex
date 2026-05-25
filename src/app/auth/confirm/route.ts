import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Handles Supabase email links (recovery, invite, etc.) that redirect with ?code= or token_hash.
 */
export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  if (!url || !anonKey) {
    return NextResponse.redirect(`${appUrl}/login?error=auth_not_configured`)
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/reset-password'

  const redirectTo = next.startsWith('/') ? `${appUrl}${next}` : next

  const cookieStore = await cookies()
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      },
    },
  })

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(`${appUrl}/reset-password?error=invalid_link`)
    }
    return NextResponse.redirect(redirectTo)
  }

  if (tokenHash && type) {
    const email = searchParams.get('email') ?? searchParams.get('email_address') ?? ''
    const params = new URLSearchParams({ token_hash: tokenHash, type })
    if (email) params.set('email', email)
    return NextResponse.redirect(`${redirectTo}?${params.toString()}`)
  }

  return NextResponse.redirect(`${appUrl}/reset-password?error=missing_token`)
}

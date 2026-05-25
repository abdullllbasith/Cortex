import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/db/prisma'
import { createSupabaseAdminClient } from '@/lib/auth/supabaseServer'
import { sendPasswordResetEmail } from '@/lib/email/passwordResetEmail'
import { isEmailConfigured } from '@/lib/email/mailTransport'
import { supabaseOptionsForRuntime } from '@/lib/supabase/nodeTransport'

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

function createEphemeralSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  return createClient(url, anonKey, {
    ...supabaseOptionsForRuntime(),
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export class AccountNotFoundError extends Error {
  readonly code = 'ACCOUNT_NOT_FOUND'

  constructor() {
    super('No account found with this email. Please register to create one.')
    this.name = 'AccountNotFoundError'
  }
}

/**
 * Sends a Supabase recovery link via configured SMTP (Gmail) when the account exists.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase()

  const dbUser = await prisma.user.findFirst({
    where: { email: normalized, isActive: true },
    select: { fullName: true },
  })

  if (!dbUser) {
    throw new AccountNotFoundError()
  }

  const admin = createSupabaseAdminClient()
  if (!admin) {
    throw new Error(
      'Password reset requires Supabase Auth. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.',
    )
  }

  if (!isEmailConfigured()) {
    throw new Error(
      'Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS (Gmail app password) in .env.',
    )
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: normalized,
    options: { redirectTo: `${appBaseUrl()}/reset-password` },
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('not found') || msg.includes('no user')) {
      throw new AccountNotFoundError()
    }
    throw new Error(error.message)
  }

  const hashedToken = data.properties?.hashed_token
  if (!hashedToken) {
    throw new Error('Could not generate password reset link. Please try again.')
  }

  const params = new URLSearchParams({
    token_hash: hashedToken,
    type: 'recovery',
  })
  const resetUrl = `${appBaseUrl()}/reset-password?${params.toString()}`

  await sendPasswordResetEmail({
    to: normalized,
    resetUrl,
    userName: dbUser.fullName,
  })
}

/** Verify recovery token and set the new password (server-side, single step). */
export async function completePasswordReset(tokenHash: string, password: string): Promise<void> {
  const supabase = createEphemeralSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase Auth is not configured')
  }

  const { data, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'recovery',
  })

  if (verifyError) {
    console.error('[password-reset] verifyOtp:', verifyError.message)
    throw new Error(verifyError.message || 'Reset link is invalid or expired')
  }

  if (!data.session) {
    throw new Error('Reset link is invalid or expired')
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
  if (sessionError) {
    throw new Error(sessionError.message)
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    throw new Error(updateError.message)
  }
}

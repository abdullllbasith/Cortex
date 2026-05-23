import { supabase } from './client'
import { useSessionStore } from '@/store/sessionStore'
import type { User, Tenant } from '@/lib/api/types'

const REMEMBER_KEY = 'saios:remember-me'

export interface AuthResult {
  user: User
  tenant: Tenant | null
  isNewUser: boolean
  accessToken: string
  refreshToken?: string
}

function mapUser(raw: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User {
  const meta = raw.user_metadata ?? {}
  return {
    id: raw.id,
    email: raw.email ?? '',
    name: (meta.full_name as string) ?? (meta.name as string) ?? raw.email?.split('@')[0] ?? 'User',
    role: (meta.role as string) ?? 'member',
    avatarUrl: meta.avatar_url as string | undefined,
  }
}

function mapTenant(meta: Record<string, unknown>): Tenant | null {
  if (!meta.tenant_id) return null
  return {
    id: meta.tenant_id as string,
    name: (meta.tenant_name as string) ?? 'My Workspace',
    slug: (meta.tenant_slug as string) ?? 'workspace',
    plan: (meta.plan as string) ?? 'starter',
  }
}

/** Dev fallback when Supabase is not configured */
async function devAuthFallback(email: string): Promise<AuthResult> {
  const isNew = email.includes('new@') || !localStorage.getItem('saios:dev-user')
  if (!isNew) localStorage.setItem('saios:dev-user', '1')

  const user: User = {
    id: 'dev-user-1',
    email,
    name: email.split('@')[0],
    role: 'admin',
  }
  const tenant: Tenant = {
    id: 'dev-tenant-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    plan: 'professional',
  }

  return {
    user,
    tenant,
    isNewUser: isNew,
    accessToken: 'dev-token',
    refreshToken: 'dev-refresh',
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
  rememberMe = true,
): Promise<AuthResult> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REMEMBER_KEY, rememberMe ? '1' : '0')
  }

  if (!supabase) {
    const result = await devAuthFallback(email)
    useSessionStore.getState().setSession({
      user: result.user,
      tenant: result.tenant!,
      permissions: ['*'],
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    })
    return result
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error

  const meta = data.user.user_metadata ?? {}
  const isNewUser = !meta.onboarding_complete

  const result: AuthResult = {
    user: mapUser(data.user),
    tenant: mapTenant(meta),
    isNewUser,
    accessToken: data.session?.access_token ?? '',
    refreshToken: data.session?.refresh_token,
  }

  if (result.tenant) {
    useSessionStore.getState().setSession({
      user: result.user,
      tenant: result.tenant,
      permissions: (meta.permissions as string[]) ?? ['*'],
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    })
  }

  return result
}

export async function signUpWithPassword(
  email: string,
  password: string,
  metadata: Record<string, unknown>,
): Promise<AuthResult> {
  if (!supabase) {
    const result = await devAuthFallback(email)
    useSessionStore.getState().setSession({
      user: result.user,
      tenant: result.tenant!,
      permissions: ['*'],
      accessToken: result.accessToken,
    })
    return { ...result, isNewUser: true }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { ...metadata, onboarding_complete: false } },
  })
  if (error) throw error
  if (!data.user) throw new Error('Sign up failed')

  const result: AuthResult = {
    user: mapUser(data.user),
    tenant: mapTenant(metadata),
    isNewUser: true,
    accessToken: data.session?.access_token ?? '',
    refreshToken: data.session?.refresh_token,
  }

  if (result.tenant && data.session) {
    useSessionStore.getState().setSession({
      user: result.user,
      tenant: result.tenant,
      permissions: ['*'],
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    })
  }

  return result
}

export async function signInWithOAuth(provider: 'google' | 'azure') {
  if (!supabase) {
    window.location.href = '/setup'
    return
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: provider === 'azure' ? 'azure' : 'google',
    options: { redirectTo: `${window.location.origin}/login` },
  })
  if (error) throw error
}

export async function sendPasswordResetEmail(email: string) {
  if (!supabase) return
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

export async function updatePassword(password: string) {
  if (!supabase) return
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function signOut() {
  useSessionStore.getState().clearSession()
  if (supabase) await supabase.auth.signOut()
}

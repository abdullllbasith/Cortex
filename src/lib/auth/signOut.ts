'use client'

import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/auth/supabaseClient'
import { useSessionStore } from '@/store/sessionStore'

export async function signOutUser(router: ReturnType<typeof useRouter>) {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  } catch {
    /* best effort */
  }
  const supabase = createSupabaseBrowserClient()
  if (supabase) await supabase.auth.signOut()
  useSessionStore.getState().clearSession()
  router.push('/login')
}

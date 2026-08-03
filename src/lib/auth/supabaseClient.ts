'use client'

import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) return null

  browserClient = createBrowserClient(url, anonKey)
  return browserClient
}

/** @deprecated Use createSupabaseBrowserClient — kept for storage uploads */
export { supabase, uploadToStorage } from '@/lib/supabase/client'

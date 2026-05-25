import type { SupabaseClientOptions } from '@supabase/supabase-js'

/** Node.js < 22 has no global WebSocket — Supabase Realtime requires `ws`. */
export function supabaseOptionsForRuntime(): SupabaseClientOptions {
  if (typeof window !== 'undefined') return {}

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ws = require('ws') as typeof WebSocket
    return { realtime: { transport: ws } }
  } catch {
    return {}
  }
}

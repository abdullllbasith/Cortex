import { createClient } from '@supabase/supabase-js'

import { getSessionSnapshot } from '@/store/sessionStore'
import { supabaseOptionsForRuntime } from './nodeTransport'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** Browser Supabase client — optional direct access; uploads go through /api/storage/upload */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, supabaseOptionsForRuntime())
    : null

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface UploadResult {
  path: string
  publicUrl: string
}

/**
 * Upload via the server API so files get durable URLs (Supabase storage or local disk).
 */
export async function uploadToStorage(
  file: File,
  bucket: string,
  path: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResult> {
  onProgress?.({ loaded: 0, total: file.size, percentage: 10 })

  const formData = new FormData()
  formData.append('file', file)
  formData.append('bucket', bucket)
  formData.append('path', path)

  const session = getSessionSnapshot()
  const headers: Record<string, string> = {}
  if (session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`
  if (session.tenant?.id) headers['x-tenant-id'] = session.tenant.id

  const res = await fetch('/api/storage/upload', {
    method: 'POST',
    headers,
    body: formData,
  })

  onProgress?.({ loaded: file.size, total: file.size, percentage: 90 })

  if (!res.ok) {
    let message = 'Upload failed'
    try {
      const body = await res.json()
      message =
        (typeof body.error === 'object' && body.error?.message) ||
        body.message ||
        message
    } catch {
      /* non-json error */
    }
    throw new Error(message)
  }

  const json = await res.json()
  const data = json.data ?? json

  onProgress?.({ loaded: file.size, total: file.size, percentage: 100 })

  return { path: data.path, publicUrl: data.publicUrl }
}

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** Browser Supabase client — used for Storage uploads from form components */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
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
 * Upload a file to Supabase Storage with progress tracking.
 * Falls back to a local object URL when Supabase is not configured (dev).
 */
export async function uploadToStorage(
  file: File,
  bucket: string,
  path: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResult> {
  if (!supabase) {
    /* Dev fallback — no real upload */
    onProgress?.({ loaded: file.size, total: file.size, percentage: 100 })
    const publicUrl = URL.createObjectURL(file)
    return { path, publicUrl }
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, cacheControl: '3600' })

  if (error) throw new Error(error.message)

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)

  onProgress?.({ loaded: file.size, total: file.size, percentage: 100 })

  return { path: data.path, publicUrl: urlData.publicUrl }
}

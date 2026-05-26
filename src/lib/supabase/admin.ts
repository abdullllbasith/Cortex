import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseOptionsForRuntime } from './nodeTransport'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export const DEFAULT_UPLOAD_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_UPLOAD_BUCKET ?? 'uploads'

export const DEFAULT_DOCUMENT_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_DOCUMENT_BUCKET ?? 'documents'

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    ...supabaseOptionsForRuntime(),
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(supabaseUrl && serviceRoleKey)
}

const ensuredBuckets = new Set<string>()

export async function ensureStorageBucket(
  admin: SupabaseClient,
  bucket: string,
  options?: { public?: boolean; fileSizeLimit?: number },
): Promise<void> {
  if (ensuredBuckets.has(bucket)) return

  const { data: buckets, error: listError } = await admin.storage.listBuckets()
  if (listError) throw new Error(listError.message)

  const exists = buckets?.some((b) => b.name === bucket)
  if (!exists) {
    const { error: createError } = await admin.storage.createBucket(bucket, {
      public: options?.public ?? true,
      fileSizeLimit: options?.fileSizeLimit ?? 10 * 1024 * 1024,
    })
    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      throw new Error(createError.message)
    }
  }

  ensuredBuckets.add(bucket)
}

export async function uploadFileToBucket(
  admin: SupabaseClient,
  bucket: string,
  path: string,
  file: Buffer | ArrayBuffer,
  contentType: string,
): Promise<{ path: string; publicUrl: string }> {
  await ensureStorageBucket(admin, bucket)

  const body = file instanceof Buffer ? file : Buffer.from(new Uint8Array(file))

  const { data, error } = await admin.storage.from(bucket).upload(path, body, {
    upsert: true,
    cacheControl: '3600',
    contentType,
  })

  if (error) throw new Error(error.message)

  const { data: urlData } = admin.storage.from(bucket).getPublicUrl(data.path)
  return { path: data.path, publicUrl: urlData.publicUrl }
}

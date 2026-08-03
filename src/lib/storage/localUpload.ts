import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomBytes } from 'crypto'

function extensionFromMime(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
  }
  return map[contentType] ?? '.bin'
}

/** Persist uploads on local disk when Supabase storage is unavailable (dev). */
export async function saveLocalUpload(
  tenantId: string,
  relativePath: string,
  buffer: ArrayBuffer,
  contentType: string,
): Promise<{ path: string; publicUrl: string }> {
  const ext = path.extname(relativePath) || extensionFromMime(contentType)
  const filename = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`
  const dir = path.join(process.cwd(), 'public', 'tenant-uploads', tenantId)
  await mkdir(dir, { recursive: true })
  const fullPath = path.join(dir, filename)
  await writeFile(fullPath, Buffer.from(buffer))

  const publicPath = `/tenant-uploads/${tenantId}/${filename}`
  return { path: `${tenantId}/${filename}`, publicUrl: publicPath }
}

/** Reject ephemeral browser blob URLs from being stored in Postgres. */
export function normalizePersistedUrl(url: string | null | undefined): string | null | undefined {
  if (url === undefined) return undefined
  if (url == null || url === '') return null
  if (url.startsWith('blob:')) return null
  return url
}

export function isPersistedAssetUrl(url: string | null | undefined): boolean {
  if (!url) return false
  if (url.startsWith('blob:')) return false
  return url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')
}

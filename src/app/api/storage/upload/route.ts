import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess, apiError } from '@/lib/knowledge/response'
import {
  DEFAULT_UPLOAD_BUCKET,
  getSupabaseAdmin,
  uploadFileToBucket,
} from '@/lib/supabase/admin'
import { saveLocalUpload } from '@/lib/storage/localUpload'

const ALLOWED_BUCKETS = new Set([
  DEFAULT_UPLOAD_BUCKET,
  process.env.NEXT_PUBLIC_SUPABASE_DOCUMENT_BUCKET ?? 'documents',
])

function sanitizePath(path: string): string | null {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized || normalized.includes('..')) return null
  return normalized
}

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const bucket = String(formData.get('bucket') ?? DEFAULT_UPLOAD_BUCKET)
    const rawPath = String(formData.get('path') ?? '')

    if (!(file instanceof File)) {
      return apiError('File is required', 'VALIDATION_ERROR', 400)
    }

    if (!ALLOWED_BUCKETS.has(bucket)) {
      return apiError('Invalid storage bucket', 'VALIDATION_ERROR', 400)
    }

    const safePath = sanitizePath(rawPath)
    if (!safePath) {
      return apiError('Invalid storage path', 'VALIDATION_ERROR', 400)
    }

    const tenantPath = `${auth.tenantId}/${safePath}`
    const buffer = await file.arrayBuffer()
    const contentType = file.type || 'application/octet-stream'

    const admin = getSupabaseAdmin()
    const result = admin
      ? await uploadFileToBucket(admin, bucket, tenantPath, buffer, contentType)
      : await saveLocalUpload(auth.tenantId, tenantPath, buffer, contentType)

    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

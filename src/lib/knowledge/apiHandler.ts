import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { authenticateTenantRequest, TenantAuthError } from '@/middleware/tenantAuth'
import { apiError } from '@/lib/knowledge/response'
import { OptimisticLockError } from '@/lib/knowledge/knowledgeRepository'
import { DocumentParseError } from '@/lib/knowledge/documentParseErrors'
import { ProfileNotFoundError } from '@/lib/settings/profileService'
import { PurchaseOrderError } from '@/lib/inventory/purchaseOrderService'
import { InventoryError } from '@/lib/inventory/types'
import { assertPermission, resolveRoutePermission } from '@/lib/auth/rbac'
import type { Permission } from '@/lib/auth/permissions'
import { withAudit } from '@/lib/audit/auditMiddleware'

type RouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>>; auth: Awaited<ReturnType<typeof authenticateTenantRequest>> },
) => Promise<NextResponse>

export interface TenantAuthOptions {
  permission?: Permission
  skipAudit?: boolean
  resourceType?: string
}

export function withTenantAuth(handler: RouteHandler, options?: TenantAuthOptions) {
  const auditedHandler = options?.resourceType
    ? withAudit({ resourceType: options.resourceType, skipAudit: options.skipAudit }, handler)
    : handler

  return async (request: NextRequest, segmentContext: { params: Promise<Record<string, string>> }) => {
    try {
      const auth = await authenticateTenantRequest(request)
      const permission =
        options?.permission ??
        resolveRoutePermission(request.nextUrl.pathname, request.method)
      if (permission) {
        await assertPermission(auth, permission, request)
      }
      return auditedHandler(request, { ...segmentContext, auth })
    } catch (err) {
      if (err instanceof TenantAuthError) {
        return apiError(err.message, err.code, err.statusCode)
      }
      console.error('[api]', err)
      return apiError('Internal server error', 'INTERNAL_ERROR', 500)
    }
  }
}

function sanitizeClientErrorMessage(message: string): string {
  if (/invalid byte sequence for encoding/i.test(message)) {
    return 'The file contains invalid characters. Try exporting as plain text or a text-based PDF.'
  }
  if (/Object\.defineProperty called on non-object/i.test(message)) {
    return 'Could not read this PDF. Restart the app and try again, or upload TXT/CSV instead.'
  }
  if (/Array buffer allocation failed|heap out of memory/i.test(message)) {
    return 'This PDF is too large to process. Try a smaller file or export as TXT.'
  }
  if (
    message.includes('Invalid `prisma.')
    || message.includes('ConnectorError')
    || message.includes('__TURBOPACK__')
    || message.length > 200
  ) {
    return 'Something went wrong while saving this document. Please try a different file.'
  }
  return message
}

export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof DocumentParseError) {
    return apiError(err.message, 'PARSE_ERROR', 400)
  }
  if (err instanceof ProfileNotFoundError) {
    return apiError(err.message, 'NOT_FOUND', 404)
  }
  if (err instanceof ZodError) {
    return apiError('Validation failed', 'VALIDATION_ERROR', 400, {
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
  }
  if (err instanceof OptimisticLockError) {
    return apiError(err.message, 'OPTIMISTIC_LOCK', 409)
  }
  if (err instanceof PurchaseOrderError) {
    const status =
      err.code === 'NOT_FOUND' ? 404
      : err.code === 'APPROVAL_REQUIRED' || err.code === 'APPROVAL_DENIED' ? 403
      : err.code === 'INVALID_STATE' || err.code === 'VALIDATION_ERROR' || err.code === 'SUPPLIER_EMAIL_MISSING' ? 400
      : 500
    return apiError(err.message, err.code, status)
  }
  if (err instanceof InventoryError) {
    const status =
      err.code === 'INSUFFICIENT_STOCK' || err.code === 'INVALID_TRANSACTION' ? 400
      : err.code === 'PRODUCT_NOT_FOUND' || err.code === 'WAREHOUSE_NOT_FOUND' || err.code === 'VARIANT_NOT_FOUND' || err.code === 'TRANSFER_NOT_FOUND' || err.code === 'RESERVATION_NOT_FOUND' ? 404
      : 500
    return apiError(err.message, err.code, status)
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      return apiError('Record not found', 'NOT_FOUND', 404)
    }
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta.target as string[]).join(', ')
        : 'unique field'
      return apiError(`A record with this ${target} already exists`, 'UNIQUE_CONSTRAINT', 409)
    }
    if (err.code === 'P2003') {
      return apiError('Related record not found', 'FOREIGN_KEY_CONSTRAINT', 400)
    }
  }
  if (err instanceof Error) {
    const message = sanitizeClientErrorMessage(err.message)
    if (/not found/i.test(message)) {
      return apiError(message, 'NOT_FOUND', 404)
    }
    if (/no nodes|invalid config|unknown node type/i.test(message)) {
      return apiError(message, 'VALIDATION_ERROR', 400)
    }
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
  console.error('[api]', err)
  return apiError('Internal server error', 'INTERNAL_ERROR', 500)
}

export function parseQuery(request: NextRequest): Record<string, string> {
  const params: Record<string, string> = {}
  request.nextUrl.searchParams.forEach((v, k) => { params[k] = v })
  return params
}

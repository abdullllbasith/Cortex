import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { supplierProductSchema, supplierProductUpdateSchema } from '@/lib/inventory/supplierSchemas'
import {
  bulkUpdateSupplierProductPrices,
  deleteSupplierProduct,
  listSupplierProducts,
  updateSupplierProduct,
  upsertSupplierProduct,
} from '@/lib/inventory/supplierService'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const items = await listSupplierProducts(auth.tenantId, id)
    return NextResponse.json(apiSuccess(items))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const contentType = request.headers.get('content-type') ?? ''

    if (contentType.includes('text/csv') || contentType.includes('multipart/form-data')) {
      let csvText = ''
      if (contentType.includes('multipart/form-data')) {
        const form = await request.formData()
        const file = form.get('file')
        if (file instanceof File) csvText = await file.text()
      } else {
        csvText = await request.text()
      }

      const lines = csvText.split(/\r?\n/).filter(Boolean)
      const headers = lines[0]?.split(',').map((h) => h.trim().toLowerCase()) ?? []
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((h, i) => {
          row[h] = cols[i] ?? ''
        })
        return {
          productId: row.productid ?? row.product_id ?? '',
          unitCost: Number(row.unitcost ?? row.unit_cost ?? row.cost ?? 0),
        }
      })

      const result = await bulkUpdateSupplierProductPrices(auth.tenantId, id, rows)
      return NextResponse.json(apiSuccess(result), { status: 201 })
    }

    const body = supplierProductSchema.parse(await request.json())
    const record = await upsertSupplierProduct(auth.tenantId, id, body)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const query = z.object({ linkId: z.string().min(1) }).parse(parseQuery(request))
    const body = supplierProductUpdateSchema.parse(await request.json())
    const record = await updateSupplierProduct(auth.tenantId, id, query.linkId, body)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const query = z.object({ linkId: z.string().min(1) }).parse(parseQuery(request))
    const result = await deleteSupplierProduct(auth.tenantId, id, query.linkId)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

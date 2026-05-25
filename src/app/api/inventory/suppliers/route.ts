import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { supplierCreateSchema, supplierListQuerySchema } from '@/lib/inventory/supplierSchemas'
import { createSupplier, importSuppliersFromCsv, listSuppliers } from '@/lib/inventory/supplierService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = supplierListQuerySchema.parse(parseQuery(request))
    const result = await listSuppliers(auth.tenantId, query)
    return NextResponse.json(
      apiSuccess({ items: result.items, stats: result.stats }, paginatedMeta(result.page, result.limit, result.total)),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
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
      if (lines.length < 2) {
        return NextResponse.json({ error: 'CSV must include a header row and at least one data row' }, { status: 400 })
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, ''))
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((h, i) => { row[h] = cols[i] ?? '' })
        return row
      })

      const result = await importSuppliersFromCsv(auth.tenantId, rows)
      return NextResponse.json(apiSuccess(result), { status: 201 })
    }

    const body = supplierCreateSchema.parse(await request.json())
    const record = await createSupplier(auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

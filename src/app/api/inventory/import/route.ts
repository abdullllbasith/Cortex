import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { importProductsFromCsv } from '@/lib/inventory/inventoryCatalogService'

const csvImportSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1),
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const contentType = request.headers.get('content-type') ?? ''

    if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
      const text = await request.text()
      const lines = text.trim().split(/\r?\n/)
      if (lines.length < 2) {
        return NextResponse.json(
          { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'CSV must include header and at least one row' } },
          { status: 400 },
        )
      }
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
      const rows = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
        return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
      })
      const result = await importProductsFromCsv(auth.tenantId, rows, auth.userId)
      return NextResponse.json(apiSuccess(result), { status: 201 })
    }

    const body = csvImportSchema.parse(await request.json())
    const result = await importProductsFromCsv(auth.tenantId, body.rows, auth.userId)
    return NextResponse.json(apiSuccess(result), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import {
  importProductsFromCsv,
  previewCsvImport,
  type DuplicateStrategy,
} from '@/lib/inventory/inventoryCatalogService'

const csvImportSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1),
  duplicateStrategy: z.enum(['skip', 'overwrite', 'create_new']).default('skip'),
  preview: z.boolean().optional(),
})

function parseCsvText(text: string): Array<Record<string, string>> {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const contentType = request.headers.get('content-type') ?? ''

    if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
      const text = await request.text()
      const rows = parseCsvText(text)
      if (!rows.length) {
        return NextResponse.json(
          { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'CSV must include header and at least one row' } },
          { status: 400 },
        )
      }
      const preview = request.nextUrl.searchParams.get('preview') === 'true'
      if (preview) {
        const result = await previewCsvImport(auth.tenantId, rows)
        return NextResponse.json(apiSuccess(result))
      }
      const strategy = (request.nextUrl.searchParams.get('duplicateStrategy') ?? 'skip') as DuplicateStrategy
      const result = await importProductsFromCsv(auth.tenantId, rows, auth.userId, { duplicateStrategy: strategy })
      return NextResponse.json(apiSuccess(result), { status: 201 })
    }

    const body = csvImportSchema.parse(await request.json())
    if (body.preview) {
      const result = await previewCsvImport(auth.tenantId, body.rows)
      return NextResponse.json(apiSuccess(result))
    }
    const result = await importProductsFromCsv(auth.tenantId, body.rows, auth.userId, {
      duplicateStrategy: body.duplicateStrategy,
    })
    return NextResponse.json(apiSuccess(result), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

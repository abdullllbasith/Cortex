import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { importSuppliersFromCsv } from '@/lib/inventory/supplierService'

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const contentType = request.headers.get('content-type') ?? ''
    let csvText = ''

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file')
      if (!(file instanceof File)) {
        return NextResponse.json({ success: false, error: { message: 'CSV file is required' } }, { status: 400 })
      }
      csvText = await file.text()
    } else {
      csvText = await request.text()
    }

    const lines = csvText.split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: { message: 'CSV must include a header row and at least one data row' } },
        { status: 400 },
      )
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, ''))
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((h, i) => {
        row[h] = cols[i] ?? ''
      })
      return row
    })

    const result = await importSuppliersFromCsv(auth.tenantId, rows)
    return NextResponse.json(apiSuccess(result), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

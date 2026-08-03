import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { buildStockReportWorkbook } from '@/lib/inventory/inventoryExportService'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const buffer = await buildStockReportWorkbook(auth.tenantId)
    const filename = `stock-report-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
})

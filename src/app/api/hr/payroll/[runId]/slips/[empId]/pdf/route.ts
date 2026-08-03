import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { generatePaySlipPdf, getPaySlipByRunAndEmployee } from '@/lib/hr/payrollService'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { runId, empId } = await params
    const slip = await getPaySlipByRunAndEmployee(auth.tenantId, runId, empId)
    const buffer = await generatePaySlipPdf(slip.id, auth.tenantId)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="payslip-${empId}.pdf"`,
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
})

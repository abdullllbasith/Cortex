import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getEmployeeSalaryInfo, listEmployeePayrollSlips } from '@/lib/hr/payrollService'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const [salary, slips] = await Promise.all([
      getEmployeeSalaryInfo(auth.tenantId, id),
      listEmployeePayrollSlips(auth.tenantId, id),
    ])
    return NextResponse.json(apiSuccess({ salary, slips }))
  } catch (err) {
    return handleRouteError(err)
  }
})

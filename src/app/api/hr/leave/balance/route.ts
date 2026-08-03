import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getLeaveBalances } from '@/lib/hr/leaveService'
import { getEmployeeByUserId } from '@/lib/hr/employeeService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = z
      .object({
        employeeId: z.string().optional(),
        fiscalYear: z.coerce.number().int().optional(),
      })
      .parse(parseQuery(request))

    let employeeId = query.employeeId
    if (!employeeId) {
      const self = await getEmployeeByUserId(auth.tenantId, auth.userId)
      if (!self) throw new Error('No employee profile linked to your account')
      employeeId = self.id
    }

    const balances = await getLeaveBalances(auth.tenantId, employeeId, query.fiscalYear)
    return NextResponse.json(apiSuccess(balances))
  } catch (err) {
    return handleRouteError(err)
  }
})

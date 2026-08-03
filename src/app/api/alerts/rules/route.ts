import { NextResponse } from 'next/server'
import { AlertSeverity } from '@prisma/client'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { alertRuleSchema } from '@/lib/ml/schemas'
import { getAlertRules, upsertAlertRule } from '@/lib/ml/alertEngine'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const rules = await getAlertRules(auth.tenantId)
    return NextResponse.json(apiSuccess(rules))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = alertRuleSchema.parse(await request.json())
    const rule = await upsertAlertRule(auth.tenantId, {
      ...body,
      severity: body.severity as AlertSeverity,
    })
    return NextResponse.json(apiSuccess(rule), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth }) => {
  try {
    const body = alertRuleSchema.parse(await request.json())
    if (!body.id) {
      return handleRouteError(new Error('Rule id required for update'))
    }
    const rule = await upsertAlertRule(auth.tenantId, {
      ...body,
      severity: body.severity as AlertSeverity,
    })
    return NextResponse.json(apiSuccess(rule))
  } catch (err) {
    return handleRouteError(err)
  }
})

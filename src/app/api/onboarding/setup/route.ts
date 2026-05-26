import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { onboardingSetupSchema } from '@/lib/finance/financeSchemas'
import { seedDefaultAccounts } from '@/lib/finance/chartOfAccountsService'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { parseTenantSettings } from '@/lib/settings/types'

const FISCAL_MONTH_TO_NUMBER: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
}

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = onboardingSetupSchema.parse(await request.json())

    const tenant = await prisma.tenant.findUnique({ where: { id: auth.tenantId } })
    if (!tenant) {
      return NextResponse.json({ success: false, error: { message: 'Tenant not found' } }, { status: 404 })
    }

    const currentSettings = parseTenantSettings(tenant.settings)
    const currency = body.currency ?? currentSettings.currency ?? 'USD'
    const fiscalYearStartMonth =
      FISCAL_MONTH_TO_NUMBER[body.fiscalYearStart ?? ''] ??
      currentSettings.fiscalYearStartMonth ??
      1

    const nextSettings = {
      ...currentSettings,
      currency,
      fiscalYearStartMonth,
      ...(body.timezone ? { timezone: body.timezone } : {}),
    }

    await prisma.tenant.update({
      where: { id: auth.tenantId },
      data: {
        ...(body.businessName ? { name: body.businessName } : {}),
        settings: nextSettings as unknown as Prisma.InputJsonValue,
      },
    })

    const result = await seedDefaultAccounts(auth.tenantId, {
      currency,
      fiscalYearStart: body.fiscalYearStart,
    })

    return NextResponse.json(apiSuccess({ ...result, currency, fiscalYearStartMonth }))
  } catch (err) {
    return handleRouteError(err)
  }
})

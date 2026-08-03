import { prisma } from '@/lib/db/prisma'

/** Resolve GL account by subtype with code fallbacks (matches seeded COA). */
export async function resolveAccount(
  tenantId: string,
  subtype: string,
  fallbackCodes: string[],
) {
  const bySubtype = await prisma.account.findFirst({
    where: { tenantId, subtype, isActive: true },
  })
  if (bySubtype) return bySubtype

  for (const code of fallbackCodes) {
    const byCode = await prisma.account.findFirst({
      where: { tenantId, code, isActive: true },
    })
    if (byCode) return byCode
  }

  throw new Error(`Required GL account not found (${subtype}). Seed the chart of accounts first.`)
}

export const GL_ACCOUNTS = {
  CASH: { subtype: 'CASH', codes: ['1000'] },
  BANK: { subtype: 'BANK', codes: ['1010', '1000'] },
  AR: { subtype: 'AR', codes: ['1100'] },
  INVENTORY: { subtype: 'INVENTORY', codes: ['1200'] },
  AP: { subtype: 'AP', codes: ['2000'] },
  SALARIES_PAYABLE: { subtype: 'SALARIES_PAYABLE', codes: ['2100'] },
  TAX_PAYABLE: { subtype: 'TAX', codes: ['2200'] },
  TAX: { subtype: 'TAX', codes: ['2200'] },
  SALES: { subtype: 'SALES', codes: ['4000', '4100'] },
  COGS: { subtype: 'COGS', codes: ['5000'] },
  PAYROLL: { subtype: 'PAYROLL', codes: ['6000'] },
  RENT: { subtype: 'RENT', codes: ['6100'] },
} as const

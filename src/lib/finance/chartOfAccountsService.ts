import { AccountType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { getAccountBalance } from './journalEngine'
import type { AccountTreeNode, LedgerEntry } from './financeTypes'
import { signedBalance, toNumber } from './financeTypes'

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

interface DefaultAccountSeed {
  code: string
  name: string
  type: AccountType
  subtype?: string
  description?: string
}

/** Standard chart of accounts seeded at tenant onboarding. */
const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccountSeed[] = [
  { code: '1000', name: 'Cash on Hand', type: 'ASSET', subtype: 'CASH' },
  { code: '1010', name: 'Bank Account', type: 'ASSET', subtype: 'BANK' },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET', subtype: 'AR' },
  { code: '1200', name: 'Inventory Asset', type: 'ASSET', subtype: 'INVENTORY' },
  { code: '1300', name: 'Prepaid Expenses', type: 'ASSET', subtype: 'PREPAID' },
  { code: '1400', name: 'Other Current Assets', type: 'ASSET', subtype: 'OTHER_CURRENT_ASSET' },
  { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', subtype: 'AP' },
  { code: '2100', name: 'Salaries Payable', type: 'LIABILITY', subtype: 'SALARIES_PAYABLE' },
  { code: '2200', name: 'Tax Payable', type: 'LIABILITY', subtype: 'TAX' },
  { code: '2300', name: 'Other Current Liabilities', type: 'LIABILITY', subtype: 'OTHER_CURRENT_LIABILITY' },
  { code: '3000', name: 'Owner Capital', type: 'EQUITY', subtype: 'CAPITAL' },
  { code: '3100', name: 'Retained Earnings', type: 'EQUITY', subtype: 'RETAINED' },
  { code: '3200', name: 'Current Year Earnings', type: 'EQUITY', subtype: 'CURRENT_EARNINGS' },
  { code: '4000', name: 'Sales Revenue', type: 'REVENUE', subtype: 'SALES' },
  { code: '4100', name: 'Service Revenue', type: 'REVENUE', subtype: 'SERVICE' },
  { code: '4900', name: 'Other Income', type: 'REVENUE', subtype: 'OTHER_INCOME' },
  { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE', subtype: 'COGS' },
  { code: '5100', name: 'Purchase Returns', type: 'EXPENSE', subtype: 'PURCHASE_RETURNS' },
  { code: '6000', name: 'Salaries Expense', type: 'EXPENSE', subtype: 'PAYROLL' },
  { code: '6100', name: 'Rent Expense', type: 'EXPENSE', subtype: 'RENT' },
  { code: '6200', name: 'Utilities', type: 'EXPENSE', subtype: 'UTILITIES' },
  { code: '6300', name: 'Marketing', type: 'EXPENSE', subtype: 'MARKETING' },
  { code: '6400', name: 'Professional Fees', type: 'EXPENSE', subtype: 'PROFESSIONAL' },
  { code: '6900', name: 'Other Expenses', type: 'EXPENSE', subtype: 'OTHER_EXPENSE' },
]

export interface SeedAccountsOptions {
  currency?: string
  fiscalYearStart?: string
}

function fiscalYearBounds(fyYear: number, startMonth: number): { start: Date; end: Date; name: string } {
  const start = new Date(Date.UTC(fyYear, startMonth - 1, 1))
  const end = new Date(Date.UTC(fyYear + 1, startMonth - 1, 0, 23, 59, 59, 999))
  return { start, end, name: `FY ${fyYear}` }
}

export async function seedDefaultAccounts(tenantId: string, options: SeedAccountsOptions = {}) {
  const existing = await prisma.account.count({ where: { tenantId } })
  if (existing > 0) return { seeded: false, count: existing }

  const currency = options.currency ?? 'USD'
  await prisma.account.createMany({
    data: DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({
      tenantId,
      code: a.code,
      name: a.name,
      type: a.type,
      subtype: a.subtype ?? null,
      description: a.description ?? null,
      currency,
      isSystem: true,
    })),
  })

  const startMonth = FISCAL_MONTH_TO_NUMBER[options.fiscalYearStart ?? 'January'] ?? 1
  const now = new Date()
  let fyYear = now.getUTCFullYear()
  if (now.getUTCMonth() + 1 < startMonth) fyYear -= 1
  const { start, end, name } = fiscalYearBounds(fyYear, startMonth)

  await prisma.fiscalPeriod.create({
    data: { tenantId, name, startDate: start, endDate: end },
  })

  const taxExisting = await prisma.taxRate.count({ where: { tenantId } })
  if (taxExisting === 0) {
    await prisma.taxRate.create({
      data: {
        tenantId,
        name: 'Standard Sales Tax',
        rate: 0,
        type: 'SALES',
        isDefault: true,
      },
    })
  }

  const count = await prisma.account.count({ where: { tenantId } })
  return { seeded: true, count }
}

async function logFinanceAudit(
  tenantId: string,
  resourceType: string,
  resourceId: string,
  action: string,
  userId?: string,
  newValue?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action,
      resourceType,
      resourceId,
      newValue: newValue as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function listAccounts(
  tenantId: string,
  opts: { type?: AccountType; search?: string } = {},
) {
  const where: Prisma.AccountWhereInput = { tenantId, isActive: true }
  if (opts.type) where.type = opts.type
  if (opts.search) {
    where.OR = [
      { name: { contains: opts.search, mode: 'insensitive' } },
      { code: { contains: opts.search, mode: 'insensitive' } },
    ]
  }

  const accounts = await prisma.account.findMany({
    where,
    orderBy: [{ code: 'asc' }],
  })

  return Promise.all(
    accounts.map(async (a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      parentId: a.parentId,
      isSystem: a.isSystem,
      isActive: a.isActive,
      currency: a.currency,
      balance: await getAccountBalance(a.id, tenantId),
    })),
  )
}

type AccountRow = {
  id: string
  code: string
  name: string
  type: AccountType
  subtype: string | null
  parentId: string | null
  isSystem: boolean
  isActive: boolean
  description: string | null
  currency: string
  depth: number
}

/** Recursive PostgreSQL CTE → in-memory tree with rolled-up balances. */
export async function getHierarchy(tenantId: string, asOfDate?: Date): Promise<AccountTreeNode[]> {
  const rows = await prisma.$queryRaw<AccountRow[]>`
    WITH RECURSIVE account_tree AS (
      SELECT
        a.id,
        a.code,
        a.name,
        a.type::text AS type,
        a.subtype,
        a."parentId",
        a."isSystem",
        a."isActive",
        a.description,
        a.currency,
        0 AS depth
      FROM finance_accounts a
      WHERE a."tenantId" = ${tenantId}
        AND a."isActive" = true
        AND a."parentId" IS NULL
      UNION ALL
      SELECT
        c.id,
        c.code,
        c.name,
        c.type::text AS type,
        c.subtype,
        c."parentId",
        c."isSystem",
        c."isActive",
        c.description,
        c.currency,
        t.depth + 1
      FROM finance_accounts c
      INNER JOIN account_tree t ON c."parentId" = t.id
      WHERE c."tenantId" = ${tenantId}
        AND c."isActive" = true
    )
    SELECT * FROM account_tree
    ORDER BY code ASC
  `

  const balanceMap = new Map<string, number>()
  await Promise.all(
    rows.map(async (a) => {
      balanceMap.set(a.id, await getAccountBalance(a.id, tenantId, asOfDate))
    }),
  )

  const nodeMap = new Map<string, AccountTreeNode>()
  const roots: AccountTreeNode[] = []

  for (const a of rows) {
    nodeMap.set(a.id, {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type as AccountType,
      subtype: a.subtype,
      parentId: a.parentId,
      isSystem: a.isSystem,
      isActive: a.isActive,
      description: a.description,
      currency: a.currency,
      balance: balanceMap.get(a.id) ?? 0,
      children: [],
    })
  }

  for (const a of rows) {
    const node = nodeMap.get(a.id)!
    if (a.parentId && nodeMap.has(a.parentId)) {
      nodeMap.get(a.parentId)!.children.push(node)
    } else if (!a.parentId) {
      roots.push(node)
    }
  }

  function rollUpBalance(node: AccountTreeNode): number {
    let total = node.balance
    for (const child of node.children) {
      total += rollUpBalance(child)
    }
    node.balance = Math.round(total * 100) / 100
    return node.balance
  }

  for (const root of roots) rollUpBalance(root)
  return roots
}

/** Flat accounts grouped by type for accordion UI (includes accounts without parents). */
export async function getAccountsByType(tenantId: string, asOfDate?: Date) {
  const accounts = await prisma.account.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ type: 'asc' }, { code: 'asc' }],
  })

  const withBalance = await Promise.all(
    accounts.map(async (a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      parentId: a.parentId,
      isSystem: a.isSystem,
      isActive: a.isActive,
      description: a.description,
      currency: a.currency,
      balance: await getAccountBalance(a.id, tenantId, asOfDate),
      children: [] as AccountTreeNode[],
    })),
  )

  const order: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']
  return order
    .map((type) => ({
      type,
      accounts: withBalance.filter((a) => a.type === type),
    }))
    .filter((g) => g.accounts.length > 0)
}

export async function getAccount(tenantId: string, id: string) {
  const account = await prisma.account.findFirst({ where: { id, tenantId } })
  if (!account) throw new Error('Account not found')
  const balance = await getAccountBalance(id, tenantId)
  return {
    ...account,
    balance,
  }
}

export async function createAccount(
  tenantId: string,
  data: {
    code: string
    name: string
    type: AccountType
    subtype?: string | null
    parentId?: string | null
    description?: string | null
    currency?: string
  },
  actorId?: string,
) {
  if (data.parentId) {
    const parent = await prisma.account.findFirst({ where: { id: data.parentId, tenantId } })
    if (!parent) throw new Error('Parent account not found')
  }

  const dup = await prisma.account.findFirst({ where: { tenantId, code: data.code } })
  if (dup) throw new Error('Account code already exists')

  const account = await prisma.account.create({
    data: {
      tenantId,
      code: data.code,
      name: data.name,
      type: data.type,
      subtype: data.subtype ?? null,
      parentId: data.parentId ?? null,
      description: data.description ?? null,
      currency: data.currency ?? 'USD',
      isSystem: false,
    },
  })

  await logFinanceAudit(tenantId, 'finance_account', account.id, 'ACCOUNT_CREATED', actorId, {
    code: account.code,
    name: account.name,
  })

  return getAccount(tenantId, account.id)
}

export async function updateAccount(
  tenantId: string,
  id: string,
  data: Partial<{
    code: string
    name: string
    type: AccountType
    subtype: string | null
    parentId: string | null
    description: string | null
    currency: string
    isActive: boolean
  }>,
  actorId?: string,
) {
  const existing = await prisma.account.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Account not found')
  if (existing.isSystem && (data.code || data.type)) {
    throw new Error('System accounts cannot change code or type')
  }

  if (data.code && data.code !== existing.code) {
    const dup = await prisma.account.findFirst({ where: { tenantId, code: data.code, NOT: { id } } })
    if (dup) throw new Error('Account code already exists')
  }

  await prisma.account.update({ where: { id }, data })
  await logFinanceAudit(tenantId, 'finance_account', id, 'ACCOUNT_UPDATED', actorId)
  return getAccount(tenantId, id)
}

export async function getAccountLedger(
  tenantId: string,
  accountId: string,
  dateRange: { from?: string; to?: string; page?: number; limit?: number } = {},
): Promise<{ items: LedgerEntry[]; total: number; page: number; limit: number }> {
  const account = await prisma.account.findFirst({ where: { id: accountId, tenantId } })
  if (!account) throw new Error('Account not found')

  const page = dateRange.page ?? 1
  const limit = dateRange.limit ?? 50
  const skip = (page - 1) * limit

  const entryFilter: Prisma.JournalEntryWhereInput = {
    tenantId,
    status: 'POSTED',
  }
  if (dateRange.from || dateRange.to) {
    entryFilter.date = {}
    if (dateRange.from) entryFilter.date.gte = new Date(dateRange.from)
    if (dateRange.to) entryFilter.date.lte = new Date(dateRange.to)
  }

  const where: Prisma.JournalLineWhereInput = {
    accountId,
    journalEntry: entryFilter,
  }

  const [lines, total] = await Promise.all([
    prisma.journalLine.findMany({
      where,
      include: {
        journalEntry: {
          select: {
            id: true,
            entryNumber: true,
            date: true,
            description: true,
            reference: true,
            status: true,
          },
        },
      },
      orderBy: [{ journalEntry: { date: 'asc' } }, { journalEntry: { entryNumber: 'asc' } }],
      skip,
      take: limit,
    }),
    prisma.journalLine.count({ where }),
  ])

  const normalBalance = (debit: number, credit: number) =>
    signedBalance(account.type, debit, credit)

  let running = 0
  if (page > 1) {
    const prior = await prisma.journalLine.findMany({
      where,
      include: { journalEntry: { select: { date: true, entryNumber: true } } },
      orderBy: [{ journalEntry: { date: 'asc' } }, { journalEntry: { entryNumber: 'asc' } }],
      take: skip,
    })
    for (const line of prior) {
      running += normalBalance(toNumber(line.debit), toNumber(line.credit))
    }
  }

  const items: LedgerEntry[] = lines.map((line) => {
    running += normalBalance(toNumber(line.debit), toNumber(line.credit))
    return {
      id: line.id,
      date: line.journalEntry.date.toISOString(),
      entryNumber: line.journalEntry.entryNumber,
      entryId: line.journalEntry.id,
      description: line.description ?? line.journalEntry.description,
      debit: toNumber(line.debit),
      credit: toNumber(line.credit),
      balance: Math.round(running * 100) / 100,
      reference: line.journalEntry.reference,
      status: line.journalEntry.status,
    }
  })

  return { items, total, page, limit }
}

export async function listTaxRates(tenantId: string) {
  const rows = await prisma.taxRate.findMany({
    where: { tenantId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    rate: toNumber(r.rate),
    type: r.type,
    isDefault: r.isDefault,
    isActive: r.isActive,
  }))
}

export async function createTaxRate(
  tenantId: string,
  data: { name: string; rate: number; type?: 'SALES' | 'PURCHASE' | 'BOTH'; isDefault?: boolean; isActive?: boolean },
) {
  if (data.isDefault) {
    await prisma.taxRate.updateMany({ where: { tenantId }, data: { isDefault: false } })
  }
  const row = await prisma.taxRate.create({
    data: {
      tenantId,
      name: data.name,
      rate: data.rate,
      type: data.type ?? 'BOTH',
      isDefault: data.isDefault ?? false,
      isActive: data.isActive ?? true,
    },
  })
  return {
    id: row.id,
    name: row.name,
    rate: toNumber(row.rate),
    type: row.type,
    isDefault: row.isDefault,
    isActive: row.isActive,
  }
}

export async function updateTaxRate(
  tenantId: string,
  id: string,
  data: Partial<{ name: string; rate: number; type: 'SALES' | 'PURCHASE' | 'BOTH'; isDefault: boolean; isActive: boolean }>,
) {
  const existing = await prisma.taxRate.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Tax rate not found')
  if (data.isDefault) {
    await prisma.taxRate.updateMany({ where: { tenantId, NOT: { id } }, data: { isDefault: false } })
  }
  const row = await prisma.taxRate.update({ where: { id }, data })
  return {
    id: row.id,
    name: row.name,
    rate: toNumber(row.rate),
    type: row.type,
    isDefault: row.isDefault,
    isActive: row.isActive,
  }
}

import {
  JournalEntryStatus,
  JournalReferenceType,
  Prisma,
} from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import type { JournalEntryInput, TrialBalanceRow } from './financeTypes'
import { isDebitNormal, signedBalance, toNumber } from './financeTypes'

function toDecimal(n: number): Decimal {
  return new Decimal(n)
}

async function nextEntryNumber(tenantId: string): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `JE-${year}-`
  const latest = await prisma.journalEntry.findFirst({
    where: { tenantId, entryNumber: { startsWith: prefix } },
    orderBy: { entryNumber: 'desc' },
    select: { entryNumber: true },
  })
  const seq = latest ? parseInt(latest.entryNumber.slice(prefix.length), 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, '0')}`
}

function validateLines(lines: JournalEntryInput['lines']) {
  if (lines.length < 2) throw new Error('Journal entry requires at least two lines')
  let debitTotal = 0
  let creditTotal = 0
  for (const line of lines) {
    if (line.debit < 0 || line.credit < 0) throw new Error('Debit and credit must be non-negative')
    if (line.debit > 0 && line.credit > 0) throw new Error('Line cannot have both debit and credit')
    if (line.debit === 0 && line.credit === 0) throw new Error('Line must have a debit or credit amount')
    debitTotal += line.debit
    creditTotal += line.credit
  }
  debitTotal = Math.round(debitTotal * 100) / 100
  creditTotal = Math.round(creditTotal * 100) / 100
  if (debitTotal !== creditTotal) {
    throw new Error(`Debits (${debitTotal}) must equal credits (${creditTotal})`)
  }
}

async function logJournalAudit(
  tenantId: string,
  entryId: string,
  action: string,
  userId?: string,
  newValue?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action,
      resourceType: 'journal_entry',
      resourceId: entryId,
      newValue: newValue as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function getAccountBalance(accountId: string, tenantId: string, asOfDate?: Date): Promise<number> {
  const account = await prisma.account.findFirst({ where: { id: accountId, tenantId } })
  if (!account) throw new Error('Account not found')

  const entryFilter: Prisma.JournalEntryWhereInput = {
    tenantId,
    status: 'POSTED',
  }
  if (asOfDate) entryFilter.date = { lte: asOfDate }

  const agg = await prisma.journalLine.aggregate({
    where: {
      accountId,
      journalEntry: entryFilter,
    },
    _sum: { debit: true, credit: true },
  })

  const debitTotal = toNumber(agg._sum.debit)
  const creditTotal = toNumber(agg._sum.credit)
  return Math.round(signedBalance(account.type, debitTotal, creditTotal) * 100) / 100
}

export async function listJournalEntries(
  tenantId: string,
  opts: {
    status?: JournalEntryStatus
    from?: string
    to?: string
    page?: number
    limit?: number
  } = {},
) {
  const page = opts.page ?? 1
  const limit = opts.limit ?? 25
  const where: Prisma.JournalEntryWhereInput = { tenantId }
  if (opts.status) where.status = opts.status
  if (opts.from || opts.to) {
    where.date = {}
    if (opts.from) where.date.gte = new Date(opts.from)
    if (opts.to) where.date.lte = new Date(opts.to)
  }

  const [items, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      include: {
        lines: { include: { account: { select: { id: true, code: true, name: true } } } },
        postedByUser: { select: { id: true, fullName: true } },
      },
      orderBy: [{ date: 'desc' }, { entryNumber: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.journalEntry.count({ where }),
  ])

  return {
    items: items.map((e) => ({
      id: e.id,
      entryNumber: e.entryNumber,
      date: e.date.toISOString(),
      description: e.description,
      reference: e.reference,
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      status: e.status,
      postedAt: e.postedAt?.toISOString() ?? null,
      postedBy: e.postedByUser?.fullName ?? null,
      lines: e.lines.map((l) => ({
        id: l.id,
        accountId: l.accountId,
        accountCode: l.account.code,
        accountName: l.account.name,
        description: l.description,
        debit: toNumber(l.debit),
        credit: toNumber(l.credit),
      })),
    })),
    total,
    page,
    limit,
  }
}

export async function getJournalEntry(tenantId: string, id: string) {
  const entry = await prisma.journalEntry.findFirst({
    where: { id, tenantId },
    include: {
      lines: { include: { account: { select: { id: true, code: true, name: true, type: true } } } },
      postedByUser: { select: { id: true, fullName: true } },
    },
  })
  if (!entry) throw new Error('Journal entry not found')
  return {
    ...entry,
    date: entry.date.toISOString(),
    postedAt: entry.postedAt?.toISOString() ?? null,
    voidedAt: entry.voidedAt?.toISOString() ?? null,
    lines: entry.lines.map((l) => ({
      ...l,
      debit: toNumber(l.debit),
      credit: toNumber(l.credit),
      exchangeRate: toNumber(l.exchangeRate),
    })),
  }
}

export async function post(
  tenantId: string,
  input: JournalEntryInput,
  actorId?: string,
) {
  validateLines(input.lines)

  const accountIds = [...new Set(input.lines.map((l) => l.accountId))]
  const accounts = await prisma.account.findMany({
    where: { tenantId, id: { in: accountIds }, isActive: true },
    select: { id: true },
  })
  if (accounts.length !== accountIds.length) throw new Error('One or more accounts not found or inactive')

  const entryNumber = await nextEntryNumber(tenantId)
  const shouldPost = input.post !== false

  const entry = await prisma.journalEntry.create({
    data: {
      tenantId,
      entryNumber,
      date: new Date(input.date),
      description: input.description,
      reference: input.reference ?? null,
      referenceType: (input.referenceType ?? 'ADJUSTMENT') as JournalReferenceType,
      referenceId: input.referenceId ?? null,
      status: shouldPost ? 'POSTED' : 'DRAFT',
      postedBy: shouldPost ? actorId ?? null : null,
      postedAt: shouldPost ? new Date() : null,
      lines: {
        create: input.lines.map((line) => ({
          accountId: line.accountId,
          description: line.description ?? null,
          debit: toDecimal(line.debit),
          credit: toDecimal(line.credit),
          currency: line.currency ?? 'USD',
          exchangeRate: toDecimal(line.exchangeRate ?? 1),
        })),
      },
    },
    include: {
      lines: { include: { account: { select: { code: true, name: true } } } },
    },
  })

  await logJournalAudit(tenantId, entry.id, shouldPost ? 'JOURNAL_POSTED' : 'JOURNAL_CREATED', actorId, {
    entryNumber: entry.entryNumber,
  })

  return getJournalEntry(tenantId, entry.id)
}

export async function voidEntry(entryId: string, tenantId: string, reason: string, actorId?: string) {
  const original = await prisma.journalEntry.findFirst({
    where: { id: entryId, tenantId },
    include: { lines: true },
  })
  if (!original) throw new Error('Journal entry not found')
  if (original.status === 'VOIDED') throw new Error('Entry already voided')
  if (original.status !== 'POSTED') throw new Error('Only posted entries can be voided')

  const reversingLines = original.lines.map((line) => ({
    accountId: line.accountId,
    description: `Reversal: ${line.description ?? original.description}`,
    debit: toNumber(line.credit),
    credit: toNumber(line.debit),
    currency: line.currency,
    exchangeRate: toNumber(line.exchangeRate),
  }))

  const reversal = await post(
    tenantId,
    {
      date: new Date(),
      description: `Void of ${original.entryNumber}: ${reason}`,
      reference: original.entryNumber,
      referenceType: 'ADJUSTMENT',
      referenceId: original.id,
      lines: reversingLines,
      post: true,
    },
    actorId,
  )

  await prisma.journalEntry.update({
    where: { id: entryId },
    data: {
      status: 'VOIDED',
      voidReason: reason,
      voidedBy: actorId ?? null,
      voidedAt: new Date(),
    },
  })

  await logJournalAudit(tenantId, entryId, 'JOURNAL_VOIDED', actorId, {
    reason,
    reversalEntryId: reversal.id,
  })

  return {
    voided: await getJournalEntry(tenantId, entryId),
    reversal,
  }
}

export async function getTrialBalance(tenantId: string, asOfDate?: Date) {
  const accounts = await prisma.account.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ code: 'asc' }],
  })

  const entryFilter: Prisma.JournalEntryWhereInput = {
    tenantId,
    status: 'POSTED',
  }
  if (asOfDate) entryFilter.date = { lte: asOfDate }

  const rows: TrialBalanceRow[] = []
  let totalDebits = 0
  let totalCredits = 0

  for (const account of accounts) {
    const agg = await prisma.journalLine.aggregate({
      where: {
        accountId: account.id,
        journalEntry: entryFilter,
      },
      _sum: { debit: true, credit: true },
    })
    const debitTotal = toNumber(agg._sum.debit)
    const creditTotal = toNumber(agg._sum.credit)
    if (debitTotal === 0 && creditTotal === 0) continue

    const balance = signedBalance(account.type, debitTotal, creditTotal)
    totalDebits += debitTotal
    totalCredits += creditTotal

    rows.push({
      accountId: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      debitTotal: Math.round(debitTotal * 100) / 100,
      creditTotal: Math.round(creditTotal * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    })
  }

  totalDebits = Math.round(totalDebits * 100) / 100
  totalCredits = Math.round(totalCredits * 100) / 100

  return {
    asOf: (asOfDate ?? new Date()).toISOString(),
    rows,
    totalDebits,
    totalCredits,
    isBalanced: totalDebits === totalCredits,
  }
}

export async function postDraftEntry(entryId: string, tenantId: string, actorId?: string) {
  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, tenantId },
    include: { lines: true },
  })
  if (!entry) throw new Error('Journal entry not found')
  if (entry.status !== 'DRAFT') throw new Error('Only draft entries can be posted')

  validateLines(
    entry.lines.map((l) => ({
      accountId: l.accountId,
      debit: toNumber(l.debit),
      credit: toNumber(l.credit),
    })),
  )

  await prisma.journalEntry.update({
    where: { id: entryId },
    data: {
      status: 'POSTED',
      postedBy: actorId ?? null,
      postedAt: new Date(),
    },
  })

  await logJournalAudit(tenantId, entryId, 'JOURNAL_POSTED', actorId)
  return getJournalEntry(tenantId, entryId)
}

/** Void a posted journal entry (creates reversing entry). */
export async function voidJournalEntry(
  entryId: string,
  tenantId: string,
  reason: string,
  voidedBy: string,
) {
  return voidEntry(entryId, tenantId, reason, voidedBy)
}

// Re-export balance helper used by chartOfAccountsService
export { isDebitNormal, signedBalance }

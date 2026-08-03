import type { AccountType, JournalEntryStatus, JournalReferenceType, TaxRateType } from '@prisma/client'

export interface AccountTreeNode {
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
  balance: number
  children: AccountTreeNode[]
}

export interface JournalLineInput {
  accountId: string
  description?: string
  debit: number
  credit: number
  currency?: string
  exchangeRate?: number
}

export interface JournalEntryInput {
  date: string | Date
  description: string
  reference?: string
  referenceType?: JournalReferenceType
  referenceId?: string
  lines: JournalLineInput[]
  post?: boolean
}

export interface LedgerEntry {
  id: string
  date: string
  entryNumber: string
  entryId: string
  description: string | null
  debit: number
  credit: number
  balance: number
  reference: string | null
  status: JournalEntryStatus
}

export interface TrialBalanceRow {
  accountId: string
  code: string
  name: string
  type: AccountType
  debitTotal: number
  creditTotal: number
  balance: number
}

export interface TaxRateDTO {
  id: string
  name: string
  rate: number
  type: TaxRateType
  isDefault: boolean
  isActive: boolean
}

export function isDebitNormal(type: AccountType): boolean {
  return type === 'ASSET' || type === 'EXPENSE'
}

export function signedBalance(type: AccountType, debitTotal: number, creditTotal: number): number {
  const net = debitTotal - creditTotal
  return isDebitNormal(type) ? net : -net
}

export function toNumber(value: unknown): number {
  if (value == null) return 0
  return Number(value)
}

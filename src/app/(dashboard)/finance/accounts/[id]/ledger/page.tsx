import type { Metadata } from 'next'
import { AccountLedgerPageClient } from '@/components/finance/AccountLedgerPageClient'

export const metadata: Metadata = { title: 'Account Ledger' }

export default async function AccountLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <AccountLedgerPageClient accountId={id} />
}

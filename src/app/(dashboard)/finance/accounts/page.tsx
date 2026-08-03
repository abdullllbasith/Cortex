import type { Metadata } from 'next'
import { AccountsPageClient } from '@/components/finance/AccountsPageClient'

export const metadata: Metadata = { title: 'Chart of Accounts' }

export default function FinanceAccountsPage() {
  return <AccountsPageClient />
}

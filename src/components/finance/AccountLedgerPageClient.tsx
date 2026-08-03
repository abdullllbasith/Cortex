'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader, Button, Card, CardBody, Badge } from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher } from '@/lib/api/apiClient'

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'

interface LedgerRow extends Record<string, unknown> {
  id: string
  date: string
  entryNumber: string
  description: string | null
  debit: number
  credit: number
  balance: number
  reference: string | null
}

interface AccountDetail {
  id: string
  code: string
  name: string
  type: AccountType
  currency: string
  balance: number
}

function formatMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function formatDate(v: string) {
  return new Date(v).toLocaleDateString()
}

export function AccountLedgerPageClient({ accountId }: { accountId: string }) {
  const { data: account } = useSWR<AccountDetail>(
    `/finance/accounts/${accountId}`,
    swrFetcher,
  )

  const { data: ledgerData, isLoading } = useSWR<{ items: LedgerRow[]; total: number }>(
    `/finance/accounts/${accountId}/ledger?limit=200`,
    swrFetcher,
  )

  const columns: ColumnDef<LedgerRow>[] = useMemo(
    () => [
      { id: 'date', header: 'Date', cell: ({ row }) => formatDate(row.date) },
      { id: 'entry', header: 'Entry #', cell: ({ row }) => <span className="font-mono text-xs">{row.entryNumber}</span> },
      { id: 'desc', header: 'Description', cell: ({ row }) => row.description ?? '—' },
      { id: 'debit', header: 'Debit', cell: ({ row }) => (row.debit > 0 ? formatMoney(row.debit) : '—') },
      { id: 'credit', header: 'Credit', cell: ({ row }) => (row.credit > 0 ? formatMoney(row.credit) : '—') },
      { id: 'balance', header: 'Running Balance', cell: ({ row }) => formatMoney(row.balance, account?.currency) },
    ],
    [account?.currency],
  )

  return (
    <div className="space-y-6 p-5 lg:p-6">
      <PageHeader
        title={account ? `${account.code} — ${account.name}` : 'Account Ledger'}
        subtitle={account ? `Full ledger · ${formatMoney(account.balance, account.currency)} current balance` : 'Loading…'}
        breadcrumbs={[
          { label: 'Finance', href: '/finance' },
          { label: 'Accounts', href: '/finance/accounts' },
          { label: 'Ledger' },
        ]}
        actions={
          <Link href="/finance/accounts">
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to accounts</Button>
          </Link>
        }
      />

      {account && (
        <div className="flex gap-2">
          <Badge>{account.type}</Badge>
          <span className="text-sm text-slate-500">{ledgerData?.total ?? 0} posted line(s)</span>
        </div>
      )}

      <Card>
        <CardBody className="p-4">
          <DataTable
            columns={columns}
            data={ledgerData?.items ?? []}
            loading={isLoading}
            emptyDescription="No posted journal lines for this account"
          />
        </CardBody>
      </Card>
    </div>
  )
}

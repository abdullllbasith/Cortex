'use client'

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Plus, BookOpen, X, ExternalLink } from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Badge,
  Input,
  toast,
} from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'

interface AccountNode {
  id: string
  code: string
  name: string
  type: AccountType
  subtype: string | null
  parentId: string | null
  isSystem: boolean
  isActive: boolean
  currency: string
  balance: number
  children: AccountNode[]
}

interface TypeGroup {
  type: AccountType
  accounts: AccountNode[]
}

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

const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expenses',
}

const TYPE_VARIANT: Record<AccountType, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  ASSET: 'info',
  LIABILITY: 'warning',
  EQUITY: 'default',
  REVENUE: 'success',
  EXPENSE: 'danger',
}

function formatMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function formatDate(v: string) {
  return new Date(v).toLocaleDateString()
}

export function AccountsPageClient() {
  const [expandedTypes, setExpandedTypes] = useState<Set<AccountType>>(
    new Set(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  )
  const [selected, setSelected] = useState<AccountNode | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [parentForAdd, setParentForAdd] = useState<AccountNode | null>(null)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const { data, mutate, isLoading } = useSWR<{ groups: TypeGroup[] }>(
    '/finance/accounts?byType=true',
    swrFetcher,
  )
  const groups = data?.groups ?? []

  const ledgerKey = selected
    ? `/finance/accounts/${selected.id}/ledger?limit=20`
    : null
  const { data: ledgerData, isLoading: ledgerLoading } = useSWR<{ items: LedgerRow[] }>(
    ledgerKey,
    swrFetcher,
  )
  const ledgerRows = ledgerData?.items ?? []

  const ledgerColumns: ColumnDef<LedgerRow>[] = useMemo(
    () => [
      { id: 'date', header: 'Date', cell: ({ row }) => formatDate(row.date) },
      { id: 'entry', header: 'Entry #', cell: ({ row }) => <span className="font-mono text-xs">{row.entryNumber}</span> },
      { id: 'desc', header: 'Description', cell: ({ row }) => row.description ?? '—' },
      { id: 'debit', header: 'Debit', cell: ({ row }) => (row.debit > 0 ? formatMoney(row.debit) : '—') },
      { id: 'credit', header: 'Credit', cell: ({ row }) => (row.credit > 0 ? formatMoney(row.credit) : '—') },
      { id: 'balance', header: 'Balance', cell: ({ row }) => formatMoney(row.balance) },
    ],
    [],
  )

  const toggleType = useCallback((type: AccountType) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const handleSelect = useCallback((node: AccountNode) => {
    setSelected(node)
    setShowAddForm(false)
  }, [])

  const handleAddUnder = useCallback((node: AccountNode) => {
    setParentForAdd(node)
    setNewCode('')
    setNewName('')
    setShowAddForm(true)
  }, [])

  const handleCreateAccount = async () => {
    if (!newCode.trim() || !newName.trim() || !parentForAdd) return
    setSaving(true)
    try {
      await apiClient.post('/finance/accounts', {
        code: newCode.trim(),
        name: newName.trim(),
        type: parentForAdd.type,
        parentId: parentForAdd.id,
        currency: parentForAdd.currency,
      })
      toast.success('Account created')
      setShowAddForm(false)
      setNewCode('')
      setNewName('')
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setSaving(false)
    }
  }

  const seedChart = async () => {
    try {
      const res = await apiClient.post<{ seeded?: boolean }>('/finance/accounts/seed', {})
      toast.success(res.seeded ? 'Chart of accounts created' : 'Chart already exists')
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to seed accounts')
    }
  }

  return (
    <div className="space-y-6 p-5 lg:p-6">
      <PageHeader
        title="Chart of Accounts"
        subtitle="Accounting foundation — ledger accounts, balances, and journal history"
        breadcrumbs={[
          { label: 'Finance', href: '/finance' },
          { label: 'Accounts' },
        ]}
        actions={
          <div className="flex gap-2">
            {groups.length === 0 && (
              <Button variant="outline" size="sm" onClick={() => void seedChart()}>
                Seed default COA
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const first = groups[0]?.accounts[0]
                if (first) handleAddUnder(first)
                else toast.error('Seed or load accounts first')
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add account
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardBody className="p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Accounts</h3>
            {isLoading ? (
              <p className="text-sm text-slate-500 py-8 text-center">Loading accounts…</p>
            ) : groups.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                No accounts yet. Complete onboarding or click Seed default COA.
              </p>
            ) : (
              groups.map((group) => {
                const expanded = expandedTypes.has(group.type)
                return (
                  <div key={group.type} className="mb-2 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleType(group.type)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="font-semibold text-sm flex-1 text-left">{TYPE_LABELS[group.type]}</span>
                      <Badge variant={TYPE_VARIANT[group.type]} size="sm">{group.type}</Badge>
                      <span className="text-xs text-slate-500">{group.accounts.length}</span>
                    </button>
                    {expanded && (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {group.accounts.map((acc) => (
                          <div
                            key={acc.id}
                            className={`flex items-center gap-2 px-3 py-2 group ${
                              selected?.id === acc.id
                                ? 'bg-indigo-50 dark:bg-indigo-950/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
                            }`}
                          >
                            <BookOpen className="h-4 w-4 text-indigo-500 shrink-0" />
                            <button
                              type="button"
                              onClick={() => handleSelect(acc)}
                              className="flex flex-1 items-center gap-2 min-w-0 text-left"
                            >
                              <span className="font-mono text-xs text-slate-500 w-10">{acc.code}</span>
                              <span className="text-sm truncate flex-1">{acc.name}</span>
                              <span className="text-sm font-medium tabular-nums shrink-0">
                                {formatMoney(acc.balance, acc.currency)}
                              </span>
                            </button>
                            {!acc.isSystem && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0"
                                onClick={() => handleAddUnder(acc)}
                                title="Add sub-account"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {showAddForm && parentForAdd && (
              <div className="mt-4 p-4 rounded-lg border border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    New account ({TYPE_LABELS[parentForAdd.type]}, parent: {parentForAdd.name})
                  </p>
                  <button type="button" onClick={() => setShowAddForm(false)}>
                    <X className="h-4 w-4 text-slate-400" />
                  </button>
                </div>
                <Input placeholder="Code (max 10)" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
                <Input placeholder="Account name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Button variant="primary" size="sm" onClick={() => void handleCreateAccount()} disabled={saving}>
                  {saving ? 'Creating…' : 'Create account'}
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardBody className="p-4">
            {selected ? (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-mono text-xs text-slate-500">{selected.code}</p>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selected.name}</h3>
                    <div className="flex gap-2 mt-2 items-center">
                      <Badge variant={TYPE_VARIANT[selected.type]}>{selected.type}</Badge>
                      <span className="text-lg font-semibold tabular-nums">
                        {formatMoney(selected.balance, selected.currency)}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Recent ledger (20)</h4>
                  <Link href={`/finance/accounts/${selected.id}/ledger`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      View full ledger
                    </Button>
                  </Link>
                </div>
                <DataTable
                  columns={ledgerColumns}
                  data={ledgerRows}
                  loading={ledgerLoading}
                  emptyDescription="No posted journal lines for this account"
                />
              </>
            ) : (
              <div className="py-16 text-center text-slate-500">
                <BookOpen className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">Select an account to view its ledger</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

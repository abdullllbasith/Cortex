'use client'

import { useMemo, useState } from 'react'
import { Plus, Search, Users2, Workflow } from 'lucide-react'
import Link from 'next/link'
import { PageHeader, Button, Input, EmptyState, Skeleton } from '@/components/ui'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'
import { KnowledgeCard } from './KnowledgeCard'
import { CustomerCreateModal, type CustomerCreateFormValues } from './CustomerCreateModal'
import { useCustomers, useMutateCustomer } from '@/lib/api/hooks/useCustomers'
import { mapListItemToKnowledgeCard } from '@/lib/knowledge/knowledgeCardDisplay'

export function CustomersPageContent() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const { data, mutate, isLoading } = useCustomers({ search: query || undefined, limit: 50 })
  const { create } = useMutateCustomer()

  const customers = useMemo(() => {
    const rows = data?.data ?? []
    return rows.map((item) =>
      mapListItemToKnowledgeCard(item as unknown as Record<string, unknown>, 'customer'),
    )
  }, [data])

  async function handleCreate(values: CustomerCreateFormValues) {
    const profile: Record<string, string> = {
      name: values.name,
      email: values.email,
    }
    if (values.company) profile.company = values.company
    if (values.tier) profile.tier = values.tier

    await create.trigger({ profile })
  }

  function runSearch(e: React.FormEvent) {
    e.preventDefault()
    setQuery(search.trim())
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Customers"
        subtitle="Customer records power workflow variables and AI knowledge search"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Knowledge Base', href: '/knowledge' },
          { label: 'Customers' },
        ]}
        actions={(
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add customer
          </Button>
        )}
      />

      <ResponsiveContainer className="flex-1 space-y-6 py-6">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-100">
          <div className="flex flex-wrap items-start gap-2">
            <Workflow className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Creating a customer here fills <code className="text-xs">{'{{customer.email}}'}</code> and{' '}
              <code className="text-xs">{'{{customer.name}}'}</code> in{' '}
              <Link href="/workflows" className="font-medium underline underline-offset-2">
                active workflows
              </Link>{' '}
              with a <strong>New Customer</strong> trigger.
            </p>
          </div>
        </div>

        <form onSubmit={runSearch} className="flex max-w-md gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or company…"
            className="flex-1"
          />
          <Button type="submit" variant="secondary" size="sm">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height="120px" className="rounded-xl" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Users2 />}
            title={query ? 'No customers match your search' : 'No customers yet'}
            description={
              query
                ? 'Try a different search term or add a new customer.'
                : 'Add your first customer to populate workflows and the knowledge base.'
            }
            action={{
              label: 'Add customer',
              onClick: () => setCreateOpen(true),
            }}
          />
        ) : (
          <>
            <p className="text-xs text-slate-500">
              {data?.total ?? customers.length} customer{(data?.total ?? customers.length) === 1 ? '' : 's'}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {customers.map((item) => (
                <KnowledgeCard key={item.id} {...item} entityType="customer" />
              ))}
            </div>
          </>
        )}
      </ResponsiveContainer>

      <CustomerCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => mutate()}
        onSubmit={handleCreate}
      />
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Users, Package, Truck, FileText, Plus, Workflow } from 'lucide-react'
import { PageHeader, Button } from '@/components/ui'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'
import {
  KnowledgeSearchBar,
  KnowledgeCard,
  KnowledgeUploader,
  CustomerCreateModal,
  type CustomerCreateFormValues,
} from '@/components/knowledge'
import { cn } from '@/lib/utils'
import { apiClient, swrFetcher } from '@/lib/api/apiClient'
import { mapListItemToKnowledgeCard } from '@/lib/knowledge/knowledgeCardDisplay'
import { useMutateCustomer } from '@/lib/api/hooks/useCustomers'
import type { SemanticSearchResult } from '@/lib/embeddings/semanticSearch'

type Tab = 'customers' | 'products' | 'suppliers' | 'documents'

const TABS: { id: Tab; label: string; icon: typeof Users; entityType: SemanticSearchResult['entityType'] | 'knowledge' }[] = [
  { id: 'customers', label: 'Customers', icon: Users, entityType: 'customer' },
  { id: 'products', label: 'Products', icon: Package, entityType: 'product' },
  { id: 'suppliers', label: 'Suppliers', icon: Truck, entityType: 'supplier' },
  { id: 'documents', label: 'Business Documents', icon: FileText, entityType: 'knowledge' },
]

interface ApiListResponse<T> {
  data: T[]
  total?: number
  page?: number
  limit?: number
  meta?: { total?: number }
}

export default function KnowledgeHubPage() {
  const [activeTab, setActiveTab] = useState<Tab>('customers')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<SemanticSearchResult[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const { create } = useMutateCustomer()

  const tab = TABS.find((t) => t.id === activeTab)!
  const listEndpoint = activeTab === 'documents' ? '/knowledge' : `/${activeTab}`

  const { data: listData, mutate } = useSWR<ApiListResponse<Record<string, unknown>> | Record<string, unknown>[]>(
    searchQuery ? null : listEndpoint,
    swrFetcher,
  )

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const res = await apiClient.get<SemanticSearchResult[]>('/knowledge/search', {
        params: { query, entityType: tab.entityType, topK: 20 },
      })
      setSearchResults(res ?? [])
    } catch {
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [tab.entityType])

  const displayItems = searchQuery
    ? searchResults
    : (Array.isArray(listData) ? listData : listData?.data ?? []).map((item) =>
        mapListItemToKnowledgeCard(item, tab.entityType),
      )

  async function handleCreateCustomer(values: CustomerCreateFormValues) {
    const profile: Record<string, string> = {
      name: values.name,
      email: values.email,
    }
    if (values.company) profile.company = values.company
    if (values.tier) profile.tier = values.tier
    await create.trigger({ profile })
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Knowledge Engine"
        subtitle="Enterprise knowledge base with AI-powered semantic search"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Knowledge Base' }]}
        actions={
          activeTab === 'customers' ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add customer
            </Button>
          ) : undefined
        }
      />

      <ResponsiveContainer className="flex-1 space-y-6 py-6">
        <KnowledgeSearchBar
          onSearch={handleSearch}
          loading={searchLoading}
          resultCount={searchQuery ? searchResults.length : listData?.meta?.total}
        />

        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setActiveTab(id); setSearchQuery(''); setSearchResults([]) }}
              className={cn(
                'flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === id
                  ? 'border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'customers' && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-100">
            <div className="flex flex-wrap items-start gap-2">
              <Workflow className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Click <strong>Add customer</strong> (top right) to create a customer. If your workflow is{' '}
                <strong>Active</strong> with a <strong>New Customer</strong> trigger,{' '}
                <code className="text-xs">{'{{customer.email}}'}</code> fills automatically — no test JSON needed.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="grid-knowledge-cards">
              {displayItems.length === 0 ? (
                <p className="col-span-full py-12 text-center text-sm text-slate-400">
                  {searchQuery
                    ? 'No semantic matches found.'
                    : activeTab === 'customers'
                      ? 'No customers yet. Click Add customer above.'
                      : 'No records yet. Upload documents or seed the database.'}
                </p>
              ) : (
                displayItems.map((item) => (
                  <KnowledgeCard key={item.id} {...item} entityType={item.entityType} />
                ))
              )}
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Upload Documents</h3>
            <KnowledgeUploader onUploaded={() => mutate()} />
            {activeTab === 'customers' && (
              <p className="mt-4 text-xs text-slate-400">
                Full customer management:{' '}
                <Link href="/knowledge/customers" className="text-indigo-600 underline underline-offset-2 dark:text-indigo-400">
                  Open customers page
                </Link>
              </p>
            )}
          </div>
        </div>
      </ResponsiveContainer>

      <CustomerCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => mutate()}
        onSubmit={handleCreateCustomer}
      />
    </div>
  )
}

'use client'

import { use } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, Clock } from 'lucide-react'
import { PageHeader, Button, Skeleton } from '@/components/ui'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'
import { KnowledgeCard, EmbeddingStatusBadge, KnowledgeEntityDetails, getKnowledgeDetailTitle } from '@/components/knowledge'
import { swrFetcher } from '@/lib/api/apiClient'
import type { SemanticSearchResult } from '@/lib/embeddings/semanticSearch'

const ENTITY_MAP: Record<string, { endpoint: string; type: 'customer' | 'product' | 'supplier' | 'knowledge' }> = {
  customers: { endpoint: 'customers', type: 'customer' },
  products: { endpoint: 'products', type: 'product' },
  suppliers: { endpoint: 'suppliers', type: 'supplier' },
  documents: { endpoint: 'knowledge', type: 'knowledge' },
}

interface AuditEntry {
  id: string
  action: string
  changes: Record<string, unknown>
  createdAt: string
  actorId?: string
}

export default function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ entityType: string; id: string }>
}) {
  const { entityType, id } = use(params)
  const config = ENTITY_MAP[entityType]

  const { data, isLoading, mutate } = useSWR<Record<string, unknown>>(
    config ? `/${config.endpoint}/${id}` : null,
    swrFetcher,
  )

  const { data: similarData } = useSWR<SemanticSearchResult[]>(
    config ? `/knowledge/similar?entityType=${config.type}&entityId=${id}` : null,
    swrFetcher,
  )

  const record = data

  const title = isLoading
    ? 'Loading…'
    : record
      ? getKnowledgeDetailTitle(record, config?.type ?? 'customer', id)
      : id

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={isLoading ? 'Loading…' : title}
        subtitle={`${entityType} detail view`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Knowledge Base', href: '/knowledge' },
          { label: title },
        ]}
        actions={
          <Link href="/knowledge">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          </Link>
        }
      />

      <ResponsiveContainer className="flex-1 space-y-6 py-6">
        {isLoading ? (
          <Skeleton height="200px" className="rounded-xl" />
        ) : record ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Entity Details</h2>
                <EmbeddingStatusBadge status={record.embeddingStatus as string} />
              </div>
              <KnowledgeEntityDetails entityType={config?.type ?? 'customer'} record={record} />
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => mutate()}>Refresh</Button>
              </div>
            </div>

            {similarData && similarData.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Semantically Similar
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {similarData.map((item) => (
                    <KnowledgeCard key={item.id} {...item} />
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Clock className="h-4 w-4" /> Change Timeline
              </h3>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <Timeline entityType={config?.type ?? entityType} entityId={id} />
              </div>
            </section>
          </>
        ) : (
          <p className="text-sm text-slate-400">Record not found.</p>
        )}
      </ResponsiveContainer>
    </div>
  )
}

function Timeline({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { data } = useSWR<AuditEntry[]>(
    `audit:${entityType}:${entityId}`,
    async () => {
      // Audit log endpoint would be added in a future iteration
      return [
        { id: '1', action: 'CREATE', changes: {}, createdAt: new Date().toISOString(), actorId: 'system' },
      ]
    },
  )

  if (!data?.length) return <p className="text-xs text-slate-400">No changes recorded yet.</p>

  return (
    <ul className="space-y-3">
      {data.map((entry) => (
        <li key={entry.id} className="flex gap-3 border-l-2 border-indigo-200 pl-4 dark:border-indigo-800">
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{entry.action}</p>
            <p className="text-[10px] text-slate-400">{new Date(entry.createdAt).toLocaleString()}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KnowledgeEntityType } from '@/lib/embeddings/knowledgeIndexer'
import { EmbeddingStatusBadge } from './EmbeddingStatusBadge'

export interface KnowledgeCardProps {
  id: string
  entityType: KnowledgeEntityType
  title: string
  snippet: string
  similarity?: number
  embeddingStatus?: string
  metadata?: Record<string, unknown>
  className?: string
}

const typeLabels: Record<KnowledgeEntityType, string> = {
  customer: 'Customer',
  product: 'Product',
  supplier: 'Supplier',
  knowledge: 'Document',
  contact: 'Contact',
}

export function KnowledgeCard({
  id,
  entityType,
  title,
  snippet,
  similarity,
  embeddingStatus,
  metadata,
  className,
}: KnowledgeCardProps) {
  const href =
    entityType === 'knowledge'
      ? `/knowledge/documents/${id}`
      : entityType === 'contact'
        ? `/knowledge/contacts/${id}`
        : `/knowledge/${entityType}s/${id}`

  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-all',
        'hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800',
        className,
      )}
    >
      <Link
        href={href}
        aria-label={`View ${title}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      />

      <div className="pointer-events-none relative z-0 flex flex-1 flex-col">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {typeLabels[entityType]}
            </span>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {similarity != null && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                {Math.round(similarity * 100)}% match
              </span>
            )}
            <EmbeddingStatusBadge status={embeddingStatus} />
          </div>
        </div>

        <p className="line-clamp-2 flex-1 text-xs text-slate-500 dark:text-slate-400">{snippet}</p>

        {metadata?.type != null && (
          <p className="mt-2 text-[10px] text-slate-400">Type: {String(metadata.type)}</p>
        )}

        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-indigo-400">
          View details <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </article>
  )
}

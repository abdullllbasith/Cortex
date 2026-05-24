'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { buildKnowledgeCardTitle } from '@/lib/knowledge/knowledgeCardDisplay'

type EntityTab = 'customer' | 'product' | 'supplier' | 'knowledge'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter((item) => item && typeof item === 'object') as Record<string, unknown>[]
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function formatValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) return date.toLocaleString()
    }
    return value
  }
  return String(value)
}

function DetailField({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{formatValue(value)}</dd>
    </div>
  )
}

function DetailGrid({ fields }: { fields: Array<{ label: string; value: unknown }> }) {
  if (fields.length === 0) {
    return <p className="text-sm text-slate-400">No data</p>
  }

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map(({ label, value }) => (
        <DetailField key={label} label={label} value={value} />
      ))}
    </dl>
  )
}

function objectToFields(obj: Record<string, unknown>): Array<{ label: string; value: unknown }> {
  return Object.entries(obj).map(([key, value]) => ({
    label: formatLabel(key),
    value: typeof value === 'object' && value !== null ? JSON.stringify(value) : value,
  }))
}

function DetailTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">No records</p>
  }

  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key))
      return set
    }, new Set<string>()),
  )

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400"
              >
                {formatLabel(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-slate-700 dark:text-slate-300">
                  {formatValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetailSection({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {children}
    </section>
  )
}

function recordInfoFields(record: Record<string, unknown>) {
  return [
    { label: 'Record ID', value: record.id },
    { label: 'Embedding status', value: record.embeddingStatus },
    { label: 'Version', value: record.version },
    { label: 'Created', value: record.createdAt },
    { label: 'Updated', value: record.updatedAt },
  ]
}

function CustomerDetails({ record }: { record: Record<string, unknown> }) {
  const profile = asRecord(record.profile)

  return (
    <div className="space-y-6">
      <DetailSection title="Profile">
        <DetailGrid
          fields={[
            { label: 'Name', value: profile.name },
            { label: 'Company', value: profile.company },
            { label: 'Email', value: profile.email },
            { label: 'Tier', value: profile.tier },
            { label: 'Region', value: profile.region },
            { label: 'Phone', value: profile.phone },
          ].filter((field) => field.value != null && field.value !== '')}
        />
      </DetailSection>

      <DetailSection title="Purchase history">
        <DetailTable rows={asArray(record.purchaseHistory)} />
      </DetailSection>

      <DetailSection title="Preferences">
        <DetailGrid fields={objectToFields(asRecord(record.preferences))} />
      </DetailSection>

      <DetailSection title="Communication history">
        <DetailTable rows={asArray(record.communicationHistory)} />
      </DetailSection>

      <DetailSection title="Loyalty">
        <DetailGrid fields={objectToFields(asRecord(record.loyaltyData))} />
      </DetailSection>

      <DetailSection title="Record info">
        <DetailGrid fields={recordInfoFields(record)} />
      </DetailSection>
    </div>
  )
}

function ProductDetails({ record }: { record: Record<string, unknown> }) {
  const catalog = asRecord(record.catalog)

  return (
    <div className="space-y-6">
      <DetailSection title="Product">
        <DetailGrid
          fields={[
            { label: 'Name', value: record.name ?? catalog.name },
            { label: 'SKU', value: record.sku ?? catalog.sku },
            { label: 'Inventory level', value: record.inventoryLevel },
            { label: 'Description', value: record.description ?? catalog.description },
          ].filter((field) => field.value != null && field.value !== '')}
        />
      </DetailSection>

      <DetailSection title="Catalog">
        <DetailGrid fields={objectToFields(catalog)} />
      </DetailSection>

      <DetailSection title="Supplier info">
        <DetailGrid fields={objectToFields(asRecord(record.supplierInfo))} />
      </DetailSection>

      <DetailSection title="Pricing history">
        <DetailTable rows={asArray(record.pricingHistory)} />
      </DetailSection>

      <DetailSection title="Record info">
        <DetailGrid fields={recordInfoFields(record)} />
      </DetailSection>
    </div>
  )
}

function SupplierDetails({ record }: { record: Record<string, unknown> }) {
  return (
    <div className="space-y-6">
      <DetailSection title="Supplier">
        <DetailGrid
          fields={[
            { label: 'Name', value: record.name },
            { label: 'Performance score', value: record.performanceScore },
          ]}
        />
      </DetailSection>

      <DetailSection title="Reliability metrics">
        <DetailGrid fields={objectToFields(asRecord(record.reliabilityMetrics))} />
      </DetailSection>

      <DetailSection title="Delivery history">
        <DetailTable rows={asArray(record.deliveryHistory)} />
      </DetailSection>

      <DetailSection title="Cost trends">
        <DetailTable rows={asArray(record.costTrends)} />
      </DetailSection>

      <DetailSection title="Record info">
        <DetailGrid fields={recordInfoFields(record)} />
      </DetailSection>
    </div>
  )
}

function KnowledgeDocumentDetails({ record }: { record: Record<string, unknown> }) {
  const metadata = asRecord(record.metadata)

  return (
    <div className="space-y-6">
      <DetailSection title="Document">
        <DetailGrid
          fields={[
            { label: 'Title', value: record.title },
            { label: 'Type', value: record.type },
          ]}
        />
        <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
          {String(record.content ?? 'No content')}
        </p>
      </DetailSection>

      {Object.keys(metadata).length > 0 && (
        <DetailSection title="Metadata">
          <DetailGrid fields={objectToFields(metadata)} />
        </DetailSection>
      )}

      <DetailSection title="Record info">
        <DetailGrid fields={recordInfoFields(record)} />
      </DetailSection>
    </div>
  )
}

export interface KnowledgeEntityDetailsProps {
  entityType: EntityTab
  record: Record<string, unknown>
}

export function KnowledgeEntityDetails({ entityType, record }: KnowledgeEntityDetailsProps) {
  switch (entityType) {
    case 'customer':
      return <CustomerDetails record={record} />
    case 'product':
      return <ProductDetails record={record} />
    case 'supplier':
      return <SupplierDetails record={record} />
    case 'knowledge':
      return <KnowledgeDocumentDetails record={record} />
    default:
      return <DetailGrid fields={objectToFields(record)} />
  }
}

export function getKnowledgeDetailTitle(
  record: Record<string, unknown>,
  entityType: EntityTab,
  fallback: string,
): string {
  return buildKnowledgeCardTitle(record, entityType) || fallback
}

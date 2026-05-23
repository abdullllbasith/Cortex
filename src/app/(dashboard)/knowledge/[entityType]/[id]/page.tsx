import type { Metadata } from 'next'
import { BookOpen } from 'lucide-react'
import { PageHeader, EmptyState, Badge } from '@/components/ui'

export const metadata: Metadata = { title: 'Entity Detail' }

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ entityType: string; id: string }>
}) {
  const { entityType, id } = await params
  const label = entityType.charAt(0).toUpperCase() + entityType.slice(1)

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={`${label} #${id}`}
        subtitle={`Detail view for ${label.toLowerCase()} record`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Knowledge Base', href: '/knowledge' },
          { label: `${label}s`, href: `/knowledge/${entityType}` },
          { label: `#${id}` },
        ]}
        actions={<Badge variant="info">{label}</Badge>}
      />
      <div className="flex-1 p-6">
        <EmptyState icon={<BookOpen />} title={`${label} detail — Module 04`} description={`Full entity view with AI summary, timeline, and related records.`} />
      </div>
    </div>
  )
}

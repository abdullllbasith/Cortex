import type { Metadata } from 'next'
import { AuditPageClient } from '@/components/settings/AuditPageClient'

export const metadata: Metadata = { title: 'Audit Log' }

export default function AuditPage() {
  return <AuditPageClient />
}

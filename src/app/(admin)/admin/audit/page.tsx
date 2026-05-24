import type { Metadata } from 'next'
import { AdminAuditClient } from '@/components/admin/AdminAuditClient'

export const metadata: Metadata = { title: 'Audit Log' }

export default function AdminAuditPage() {
  return <AdminAuditClient />
}

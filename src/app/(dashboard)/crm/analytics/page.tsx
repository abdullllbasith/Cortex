import type { Metadata } from 'next'
import { CrmAnalyticsClient } from '@/components/crm/CrmAnalyticsClient'

export const metadata: Metadata = { title: 'CRM Analytics' }

export default function CrmAnalyticsPage() {
  return <CrmAnalyticsClient />
}

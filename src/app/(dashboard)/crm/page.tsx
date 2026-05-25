import type { Metadata } from 'next'
import { CrmDashboardClient } from '@/components/crm/CrmDashboardClient'

export const metadata: Metadata = { title: 'CRM' }

export default function CrmPage() {
  return <CrmDashboardClient />
}

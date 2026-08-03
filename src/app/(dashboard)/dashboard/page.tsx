import type { Metadata } from 'next'
import { MasterDashboardClient } from '@/components/dashboard/MasterDashboardClient'
import { QueryProvider } from '@/providers/QueryProvider'

export const metadata: Metadata = { title: 'Dashboard' }

export default function DashboardPage() {
  return (
    <QueryProvider>
      <MasterDashboardClient />
    </QueryProvider>
  )
}

import type { Metadata } from 'next'
import { MasterDashboardClient } from '@/components/dashboard/MasterDashboardClient'

export const metadata: Metadata = { title: 'Dashboard' }

export default function DashboardPage() {
  return <MasterDashboardClient />
}

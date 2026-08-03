import type { Metadata } from 'next'
import { HrDashboardClient } from '@/components/hr/HrDashboardClient'

export const metadata: Metadata = { title: 'HR' }

export default function HrPage() {
  return <HrDashboardClient />
}

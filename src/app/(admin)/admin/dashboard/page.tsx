import type { Metadata } from 'next'
import { AdminDashboardClient } from '@/components/admin/AdminDashboardClient'

export const metadata: Metadata = { title: 'Admin Dashboard' }

export default function AdminDashboardPage() {
  return <AdminDashboardClient />
}

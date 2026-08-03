import type { Metadata } from 'next'
import { AdminHealthClient } from '@/components/admin/AdminHealthClient'

export const metadata: Metadata = { title: 'Platform Health' }

export default function AdminHealthPage() {
  return <AdminHealthClient />
}

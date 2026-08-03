import type { Metadata } from 'next'
import { AdminTenantsClient } from '@/components/admin/AdminTenantsClient'

export const metadata: Metadata = { title: 'Tenants' }

export default function AdminTenantsPage() {
  return <AdminTenantsClient />
}

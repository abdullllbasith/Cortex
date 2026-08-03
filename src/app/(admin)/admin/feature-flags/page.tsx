import type { Metadata } from 'next'
import { AdminFeatureFlagsClient } from '@/components/admin/AdminFeatureFlagsClient'

export const metadata: Metadata = { title: 'Feature Flags' }

export default function AdminFeatureFlagsPage() {
  return <AdminFeatureFlagsClient />
}

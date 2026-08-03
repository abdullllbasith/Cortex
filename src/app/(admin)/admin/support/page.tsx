import type { Metadata } from 'next'
import { AdminSupportClient } from '@/components/admin/AdminSupportClient'

export const metadata: Metadata = { title: 'Support' }

export default function AdminSupportPage() {
  return <AdminSupportClient />
}

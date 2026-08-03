import type { Metadata } from 'next'
import { CustomersPageContent } from '@/components/knowledge/CustomersPageContent'

export const metadata: Metadata = { title: 'Customers' }

export default function CustomersPage() {
  return <CustomersPageContent />
}

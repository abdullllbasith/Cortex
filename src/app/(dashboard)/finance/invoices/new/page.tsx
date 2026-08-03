import type { Metadata } from 'next'
import { InvoiceBuilderClient } from '@/components/finance/InvoiceBuilderClient'

export const metadata: Metadata = { title: 'New Invoice' }

export default function NewInvoicePage() {
  return <InvoiceBuilderClient />
}

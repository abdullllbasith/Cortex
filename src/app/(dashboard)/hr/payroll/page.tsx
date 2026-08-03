import type { Metadata } from 'next'
import { PayrollPageClient } from '@/components/hr/PayrollPageClient'

export const metadata: Metadata = { title: 'Payroll' }

export default function HrPayrollPage() {
  return <PayrollPageClient />
}

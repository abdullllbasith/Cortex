import type { Metadata } from 'next'
import { EmployeesPageClient } from '@/components/hr/EmployeesPageClient'

export const metadata: Metadata = { title: 'Employees' }

export default function HrEmployeesPage() {
  return <EmployeesPageClient />
}

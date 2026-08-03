import type { Metadata } from 'next'
import { EmployeeProfileClient } from '@/components/hr/EmployeeProfileClient'

export const metadata: Metadata = { title: 'Employee profile' }

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EmployeeProfileClient employeeId={id} />
}

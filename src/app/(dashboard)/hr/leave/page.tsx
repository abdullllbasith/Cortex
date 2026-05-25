import type { Metadata } from 'next'
import { LeavePageClient } from '@/components/hr/LeavePageClient'

export const metadata: Metadata = { title: 'Leave management' }

export default function HrLeavePage() {
  return <LeavePageClient />
}

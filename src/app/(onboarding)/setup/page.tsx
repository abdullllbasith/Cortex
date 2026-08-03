import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SetupWizard } from '@/components/onboarding/SetupWizard'
import { Spinner } from '@/components/ui'

export const metadata: Metadata = { title: 'Workspace Setup' }

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner size="lg" /></div>}>
      <SetupWizard />
    </Suspense>
  )
}

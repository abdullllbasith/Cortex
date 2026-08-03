'use client'

import { Suspense } from 'react'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

function ResetPasswordFallback() {
  return <div className="h-80 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
}

export function ResetPasswordPageClient() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  )
}

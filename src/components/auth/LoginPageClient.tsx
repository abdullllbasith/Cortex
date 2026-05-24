'use client'

import { Suspense } from 'react'
import { LoginForm } from '@/components/auth'

function LoginFormFallback() {
  return <div className="h-96 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
}

export function LoginPageClient() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  )
}

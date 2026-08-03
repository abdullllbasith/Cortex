'use client'

import type { ReactNode } from 'react'
import { AuthBrandedPanel } from './AuthBrandedPanel'
import { AuthBackButton } from './AuthBackButton'

export function AuthSplitShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen overflow-x-clip bg-[#F7FAFA]">
      {/* Left panel — sticky, always full viewport height */}
      <aside className="relative hidden shrink-0 lg:block lg:w-[45%]">
        <div className="sticky top-0 h-screen">
          <AuthBrandedPanel />
        </div>
      </aside>

      {/* Right panel — plain light background; form always light via .auth-form-panel */}
      <div
        className="auth-form-panel relative flex min-h-screen flex-1 flex-col bg-[#F7FAFA] lg:w-[55%]"
      >
        <div className="absolute left-6 top-6 z-10 sm:left-10 lg:left-16">
          <AuthBackButton />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10 lg:px-16 xl:px-24">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function AuthCenteredShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}

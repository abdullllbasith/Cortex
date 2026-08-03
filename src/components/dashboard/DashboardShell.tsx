'use client'

import type { ReactNode } from 'react'
import { ExecutiveDashboardProvider } from './ExecutiveDashboardProvider'

export function DashboardShell({ children }: { children: ReactNode }) {
  return <ExecutiveDashboardProvider>{children}</ExecutiveDashboardProvider>
}

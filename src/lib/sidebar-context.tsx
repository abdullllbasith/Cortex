'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'

interface SidebarContextValue {
  /** Whether the desktop sidebar is collapsed to icon-only */
  collapsed: boolean
  /** Whether the mobile overlay drawer is open */
  mobileOpen: boolean
  toggle: () => void
  setCollapsed: (v: boolean) => void
  openMobile: () => void
  closeMobile: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

const STORAGE_KEY = 'saios-sidebar-collapsed'

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Hydrate from localStorage (avoids SSR mismatch)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) setCollapsedState(stored === 'true')
  }, [])

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v)
    localStorage.setItem(STORAGE_KEY, String(v))
  }, [])

  const toggle     = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed])
  const openMobile = useCallback(() => setMobileOpen(true), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  return (
    <SidebarContext.Provider
      value={{ collapsed, mobileOpen, toggle, setCollapsed, openMobile, closeMobile }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be inside <SidebarProvider>')
  return ctx
}

'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Tenant } from '@/lib/api/types'

interface SessionState {
  user: User | null
  tenant: Tenant | null
  permissions: string[]
  accessToken: string | null
  refreshToken: string | null
  /** Dev-only: false until DevSessionBootstrap finishes reconciling tenant/token. */
  devSessionSynced: boolean
  setDevSessionSynced: (synced: boolean) => void
  setSession: (data: {
    user: User
    tenant: Tenant
    permissions?: string[]
    accessToken: string
    refreshToken?: string
  }) => void
  setTokens: (accessToken: string, refreshToken?: string) => void
  updateUser: (patch: Partial<User>) => void
  updateTenant: (patch: Partial<Tenant>) => void
  clearSession: () => void
  hasPermission: (permission: string) => boolean
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      user:         null,
      tenant:       null,
      permissions:  [],
      accessToken:  null,
      refreshToken: null,
      devSessionSynced: true,
      setDevSessionSynced: (synced) => set({ devSessionSynced: synced }),

      setSession: ({ user, tenant, permissions = [], accessToken, refreshToken }) =>
        set({
          user,
          tenant,
          permissions,
          accessToken,
          refreshToken: refreshToken ?? null,
          devSessionSynced: true,
        }),

      setTokens: (accessToken, refreshToken) =>
        set((s) => ({
          accessToken,
          refreshToken: refreshToken ?? s.refreshToken,
        })),

      updateUser: (patch) =>
        set((s) => ({
          user: s.user ? { ...s.user, ...patch } : s.user,
        })),

      updateTenant: (patch) =>
        set((s) => ({
          tenant: s.tenant ? { ...s.tenant, ...patch } : s.tenant,
        })),

      clearSession: () =>
        set({
          user: null,
          tenant: null,
          permissions: [],
          accessToken: null,
          refreshToken: null,
          devSessionSynced: process.env.NODE_ENV === 'development' ? false : true,
        }),

      hasPermission: (permission) => {
        const { permissions } = get()
        return permissions.includes('*') || permissions.includes(permission)
      },
    }),
    {
      name: 'saios:session',
      partialize: (s) => ({
        user: s.user,
        tenant: s.tenant,
        permissions: s.permissions,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
    },
  ),
)

/** Non-hook accessor for apiClient (outside React) */
export function getSessionSnapshot() {
  return useSessionStore.getState()
}

/** Safe persist helpers — `persist` is unavailable during SSR. */
export function hasSessionHydrated(): boolean {
  if (typeof window === 'undefined') return false
  return useSessionStore.persist?.hasHydrated?.() ?? false
}

export function onSessionHydrated(callback: () => void): (() => void) | undefined {
  if (typeof window === 'undefined') return undefined
  const persist = useSessionStore.persist
  if (!persist?.hasHydrated || !persist.onFinishHydration) {
    callback()
    return undefined
  }
  if (persist.hasHydrated()) {
    callback()
    return undefined
  }
  return persist.onFinishHydration(callback)
}

export function rehydrateSessionStore(): void {
  if (typeof window === 'undefined') return
  if (!useSessionStore.persist?.hasHydrated?.()) {
    void useSessionStore.persist?.rehydrate?.()
  }
}

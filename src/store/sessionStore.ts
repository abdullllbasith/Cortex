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
  setSession: (data: {
    user: User
    tenant: Tenant
    permissions?: string[]
    accessToken: string
    refreshToken?: string
  }) => void
  setTokens: (accessToken: string, refreshToken?: string) => void
  updateUser: (patch: Partial<User>) => void
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

      setSession: ({ user, tenant, permissions = [], accessToken, refreshToken }) =>
        set({ user, tenant, permissions, accessToken, refreshToken: refreshToken ?? null }),

      setTokens: (accessToken, refreshToken) =>
        set((s) => ({
          accessToken,
          refreshToken: refreshToken ?? s.refreshToken,
        })),

      updateUser: (patch) =>
        set((s) => ({
          user: s.user ? { ...s.user, ...patch } : s.user,
        })),

      clearSession: () =>
        set({
          user: null,
          tenant: null,
          permissions: [],
          accessToken: null,
          refreshToken: null,
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

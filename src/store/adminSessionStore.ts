'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AdminUser {
  id: string
  email: string
  name: string
  role: string
}

interface AdminSessionState {
  admin: AdminUser | null
  accessToken: string | null
  setSession: (data: { admin: AdminUser; accessToken: string }) => void
  clearSession: () => void
}

export const useAdminSessionStore = create<AdminSessionState>()(
  persist(
    (set) => ({
      admin: null,
      accessToken: null,
      setSession: ({ admin, accessToken }) => set({ admin, accessToken }),
      clearSession: () => set({ admin: null, accessToken: null }),
    }),
    {
      name: 'saios:admin-session',
      partialize: (s) => ({
        admin: s.admin,
        accessToken: s.accessToken,
      }),
    },
  ),
)

export function getAdminSessionSnapshot() {
  return useAdminSessionStore.getState()
}

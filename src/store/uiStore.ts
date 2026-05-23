'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiState {
  sidebarCollapsed: boolean
  commandPaletteOpen: boolean
  activeModal: string | null
  theme: 'light' | 'dark' | 'system'
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebar: () => void
  setCommandPaletteOpen: (v: boolean) => void
  toggleCommandPalette: () => void
  setActiveModal: (id: string | null) => void
  setTheme: (theme: UiState['theme']) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed:    false,
      commandPaletteOpen:  false,
      activeModal:         null,
      theme:               'dark',

      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleSidebar:       () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setActiveModal:      (id) => set({ activeModal: id }),
      setTheme:            (theme) => set({ theme }),
    }),
    { name: 'saios:ui-store', partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, theme: s.theme }) },
  ),
)

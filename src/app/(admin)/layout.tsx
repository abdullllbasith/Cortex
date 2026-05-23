import { SidebarProvider } from '@/lib/sidebar-context'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { MobileSidebar } from '@/components/layout/MobileSidebar'
import { Badge } from '@/components/ui'

// TODO: check admin role (Module 01)

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <div className="hidden lg:flex">
          <Sidebar />
        </div>
        <MobileSidebar />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Admin banner */}
          <div className="flex h-7 shrink-0 items-center justify-center gap-2 bg-amber-50 dark:bg-amber-950/30">
            <Badge variant="warning" size="sm" dot>Admin Mode</Badge>
            <span className="text-xs text-amber-700 dark:text-amber-400">
              You are viewing the system administration panel
            </span>
          </div>

          <TopBar />

          <main className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}

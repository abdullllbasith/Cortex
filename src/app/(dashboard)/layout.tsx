import { SidebarProvider } from '@/lib/sidebar-context'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { MobileSidebar } from '@/components/layout/MobileSidebar'

// TODO: Replace with real auth session check (Module 01)
// import { redirect } from 'next/navigation'
// import { getSession } from '@/lib/auth'
// const session = await getSession()
// if (!session) redirect('/login')

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Desktop sidebar — hidden below lg */}
        <div className="hidden lg:flex">
          <Sidebar />
        </div>

        {/* Mobile drawer — visible below lg */}
        <MobileSidebar />

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar />
          <main
            id="main-content"
            className="flex-1 overflow-y-auto bg-white dark:bg-slate-900"
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}

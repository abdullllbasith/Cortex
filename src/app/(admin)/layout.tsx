import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminTopBar } from '@/components/admin/AdminTopBar'
import { AppViewportLock } from '@/components/layout/AppViewportLock'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppViewportLock />
      <div
        data-app-shell
        className="fixed inset-0 flex overflow-hidden overscroll-none bg-slate-100 dark:bg-slate-950"
      >
        <div className="hidden h-full md:flex">
          <AdminSidebar />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AdminTopBar />
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-area">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}

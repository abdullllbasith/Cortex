import { SidebarProvider } from '@/lib/sidebar-context'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { MobileSidebar } from '@/components/layout/MobileSidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { NotificationProvider } from '@/components/notifications/NotificationProvider'
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner'
import { TenantBrandingProvider } from '@/components/branding/TenantBrandingProvider'
import { DashboardSessionGate } from '@/components/auth/DashboardSessionGate'
import { NavigationProgress } from '@/components/navigation/NavigationProgress'
import { RoutePrefetcher } from '@/components/navigation/RoutePrefetcher'
import { DashboardMain } from '@/components/layout/DashboardMain'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardSessionGate>
      <SidebarProvider>
        <NotificationProvider>
          <TenantBrandingProvider>
          <NavigationProgress />
          <RoutePrefetcher />
          <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
            <ImpersonationBanner />
            <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="hidden md:flex">
              <Sidebar />
            </div>

            <MobileSidebar />

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <TopBar />
              <DashboardMain>{children}</DashboardMain>
            </div>

            <BottomNav />
            </div>
          </div>
          </TenantBrandingProvider>
        </NotificationProvider>
      </SidebarProvider>
    </DashboardSessionGate>
  )
}

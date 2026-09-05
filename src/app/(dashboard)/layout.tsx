import { SidebarProvider } from '@/lib/sidebar-context'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { MobileSidebar } from '@/components/layout/MobileSidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { NotificationProvider } from '@/components/notifications/NotificationProvider'
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner'
import { TenantBrandingProvider } from '@/components/branding/TenantBrandingProvider'
import { DashboardSessionGate } from '@/components/auth/DashboardSessionGate'
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard'
import { PermissionsSync } from '@/components/auth/PermissionsSync'
import { NavigationProgress } from '@/components/navigation/NavigationProgress'
import { RoutePrefetcher } from '@/components/navigation/RoutePrefetcher'
import { DashboardMain } from '@/components/layout/DashboardMain'
import { AppViewportLock } from '@/components/layout/AppViewportLock'
import { PostSignupSetupModal } from '@/components/onboarding/PostSignupSetupModal'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardSessionGate>
      <RoutePermissionGuard>
        <SidebarProvider>
          <NotificationProvider>
            <TenantBrandingProvider>
            <AppViewportLock />
            <PermissionsSync />
            <NavigationProgress />
            <RoutePrefetcher />
            <div
              data-app-shell
              className="fixed inset-0 flex flex-col overflow-hidden overscroll-none bg-slate-50 dark:bg-slate-950"
            >
              <ImpersonationBanner />
              <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="hidden h-full md:flex">
                <Sidebar />
              </div>

              <MobileSidebar />

              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <TopBar />
                <DashboardMain>{children}</DashboardMain>
              </div>

              <BottomNav />
              </div>
            </div>
            <PostSignupSetupModal />
            </TenantBrandingProvider>
          </NotificationProvider>
        </SidebarProvider>
      </RoutePermissionGuard>
    </DashboardSessionGate>
  )
}

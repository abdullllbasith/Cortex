import { SettingsMobileNav, SettingsSidebar } from '@/components/settings/SettingsNav'
import { SettingsHashScroll } from '@/components/settings/SettingsHashScroll'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SettingsHashScroll />
      <SettingsMobileNav />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SettingsSidebar />
        <div className="min-h-0 flex-1 min-w-0 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  )
}

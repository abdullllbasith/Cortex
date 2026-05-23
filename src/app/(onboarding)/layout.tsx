import { SetupHeader } from '@/components/onboarding/SetupWizard'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <SetupHeader />
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-12">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  )
}

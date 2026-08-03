import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy & Cookies',
  description: 'How Cortex uses cookies and handles your data.',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-slate-700 dark:text-slate-300">
      <Link href="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
        ← Back to Cortex
      </Link>
      <h1 className="mt-6 text-3xl font-semibold text-slate-900 dark:text-slate-100">Privacy & cookies</h1>
      <p className="mt-4 text-sm leading-relaxed">
        Cortex uses essential cookies to authenticate your session and keep the application secure. These are required
        for login and workspace access.
      </p>
      <h2 className="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Optional cookies</h2>
      <p className="mt-2 text-sm leading-relaxed">
        If you choose &quot;Accept all&quot;, we may enable optional analytics cookies to understand product usage and
        improve performance. You can use &quot;Essential only&quot; to decline optional cookies.
      </p>
      <h2 className="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Your data</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Workspace data is stored in your tenant database. For data export or deletion requests, contact your workspace
        administrator or Cortex support.
      </p>
    </main>
  )
}

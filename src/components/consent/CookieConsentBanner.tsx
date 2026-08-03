'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Cookie } from 'lucide-react'
import { Button } from '@/components/ui'
import {
  readCookieConsent,
  saveCookieConsent,
  shouldShowCookieBanner,
} from '@/lib/cookies/consent'

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!shouldShowCookieBanner()) return
    if (readCookieConsent()) return
    setVisible(true)
  }, [])

  if (!visible) return null

  function accept(essentialOnly: boolean) {
    saveCookieConsent(!essentialOnly)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95 md:p-5"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            <Cookie className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p id="cookie-consent-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              We use cookies
            </p>
            <p id="cookie-consent-desc" className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Essential cookies keep you signed in and run the app. Optional cookies help us improve Cortex if you
              allow them.{' '}
              <Link href="/legal/privacy" className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                Privacy policy
              </Link>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
          <Button size="sm" variant="ghost" onClick={() => accept(true)}>
            Essential only
          </Button>
          <Button size="sm" variant="primary" onClick={() => accept(false)}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  )
}

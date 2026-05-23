'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui'
import { PLANS } from '@/lib/auth/plans'
import { cn } from '@/lib/utils'

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-slate-200 bg-white px-6 py-20 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-100">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Start free, scale as you grow. No hidden fees.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'relative flex flex-col rounded-2xl border p-6',
                plan.highlighted
                  ? 'border-indigo-600 bg-indigo-50/30 shadow-lg shadow-indigo-100 dark:bg-indigo-950/20 dark:shadow-indigo-950/30'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
              )}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                  {plan.badge}
                </span>
              )}
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                {plan.name}
              </h3>
              <p className="mt-2 font-display text-4xl font-bold text-slate-900 dark:text-slate-100">
                {plan.price}
                {plan.period && <span className="text-base font-normal text-slate-500">{plan.period}</span>}
              </p>
              <p className="mt-2 text-sm text-slate-500">{plan.description}</p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link href={plan.id === 'enterprise' ? '/register' : '/register'} className="mt-8">
                <Button
                  variant={plan.highlighted ? 'primary' : 'secondary'}
                  size="lg"
                  className="w-full"
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 px-6 py-12 dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} Softora. All rights reserved.
        </p>
        <div className="flex gap-6 text-sm text-slate-500">
          <a href="#" className="hover:text-slate-700 dark:hover:text-slate-300">Privacy</a>
          <a href="#" className="hover:text-slate-700 dark:hover:text-slate-300">Terms</a>
          <a href="#" className="hover:text-slate-700 dark:hover:text-slate-300">Security</a>
          <Link href="/login" className="hover:text-slate-700 dark:hover:text-slate-300">Sign in</Link>
        </div>
      </div>
    </footer>
  )
}

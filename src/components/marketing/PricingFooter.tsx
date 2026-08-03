'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { PLANS } from '@/lib/auth/plans'
import { SaiosLogo } from '@/components/branding/SaiosLogo'
import { cn } from '@/lib/utils'

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative border-t border-[#1E2D3D]/8 px-6 py-24 dark:border-white/8"
    >
      {/* Subtle bg */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white to-[#F0F7F6]/60 dark:from-[#0d1b2a] dark:to-[#071018]/80" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#7ECAC3]/10 blur-[100px]" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full border border-[#5BA8A0]/30 bg-[#5BA8A0]/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#3D8E87]">
            Pricing
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-[#1E2D3D] dark:text-white">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-[#1E2D3D]/60 dark:text-white/50">
            Start free, scale as you grow. No hidden fees.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'relative flex flex-col rounded-2xl border p-6 transition-all duration-300',
                plan.highlighted
                  ? 'border-[#5BA8A0] bg-gradient-to-b from-[#F0F7F6] to-white shadow-xl shadow-[#5BA8A0]/20 dark:from-[#0d2420] dark:to-[#0d1b2a] dark:shadow-[#5BA8A0]/15'
                  : 'border-[#1E2D3D]/10 bg-white hover:border-[#5BA8A0]/40 hover:shadow-md dark:border-white/10 dark:bg-[#0d1b2a]/80',
              )}
            >
              {/* Popular badge */}
              {plan.badge && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#5BA8A0] to-[#3D8E87] px-4 py-1 text-xs font-semibold text-white shadow-md shadow-[#5BA8A0]/30">
                  {plan.badge}
                </span>
              )}

              {/* Top accent for highlighted */}
              {plan.highlighted && (
                <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-[#7ECAC3] via-[#5BA8A0] to-[#3D8E87]" />
              )}

              <h3 className="font-display text-lg font-semibold text-[#1E2D3D] dark:text-white">
                {plan.name}
              </h3>

              <p className="mt-3 font-display text-4xl font-bold text-[#1E2D3D] dark:text-white">
                {plan.price}
                {plan.period && (
                  <span className="text-base font-normal text-[#1E2D3D]/45 dark:text-white/40">
                    {plan.period}
                  </span>
                )}
              </p>

              <p className="mt-2 text-sm text-[#1E2D3D]/50 dark:text-white/40">
                {plan.description}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#1E2D3D]/70 dark:text-white/60">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#5BA8A0]/15">
                      <Check className="h-2.5 w-2.5 text-[#3D8E87]" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link href="/register" className="mt-8">
                <button
                  className={cn(
                    'w-full rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98]',
                    plan.highlighted
                      ? 'bg-gradient-to-br from-[#5BA8A0] to-[#3D8E87] text-white shadow-md shadow-[#5BA8A0]/30 hover:from-[#4D9990] hover:to-[#2F7D76] hover:shadow-lg hover:shadow-[#5BA8A0]/40'
                      : 'border border-[#1E2D3D]/15 bg-white text-[#1E2D3D] hover:border-[#5BA8A0]/50 hover:text-[#5BA8A0] dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:border-[#5BA8A0]/50',
                  )}
                >
                  {plan.cta}
                </button>
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
    <footer className="border-t border-[#1E2D3D]/8 bg-[#1E2D3D] px-6 py-14 dark:border-white/8">
      <div className="mx-auto max-w-6xl">

        <div className="mb-10 grid gap-10 sm:grid-cols-2">
          <div>
            <div className="mb-4">
              <SaiosLogo surface="dark" size="md" />
            </div>
            <p className="text-sm leading-relaxed text-white/45">
              Enterprise AI Operating System — unifying intelligence, automation, and analytics for modern businesses.
            </p>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/30">Quick Links</p>
            <div className="flex flex-col gap-2 text-sm text-white/50">
              <a href="#features"  style={{ textDecoration: 'none' }} className="text-white/50 transition-colors hover:text-[#7ECAC3]">Features</a>
              <a href="#pricing"   style={{ textDecoration: 'none' }} className="text-white/50 transition-colors hover:text-[#7ECAC3]">Pricing</a>
              <a href="/register"  style={{ textDecoration: 'none' }} className="text-white/50 transition-colors hover:text-[#7ECAC3]">Start free trial</a>
              <a href="/login"     style={{ textDecoration: 'none' }} className="text-white/50 transition-colors hover:text-[#7ECAC3]">Sign in</a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/8" />

        <div className="mt-6 flex flex-col items-center justify-between gap-3 text-xs text-white/30 sm:flex-row">
          <p>
            © {new Date().getFullYear()} Cortex. All rights reserved.
          </p>
          <div className="flex gap-5">
            <a href="#" style={{ textDecoration: 'none' }} className="text-white/30 hover:text-[#7ECAC3] transition-colors">Privacy</a>
            <a href="#" style={{ textDecoration: 'none' }} className="text-white/30 hover:text-[#7ECAC3] transition-colors">Terms</a>
            <a href="#" style={{ textDecoration: 'none' }} className="text-white/30 hover:text-[#7ECAC3] transition-colors">Security</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

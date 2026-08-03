'use client'

import { TrendingUp, Brain, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SaiosAnimatedGradientBackdrop } from '@/components/branding/SaiosAnimatedGradientBackdrop'
import { SaiosBrandLockup } from '@/components/branding/SaiosBrandLockup'

const METRICS = [
  {
    icon: TrendingUp,
    label: 'Revenue tracked',
    value: '$2.4M',
    change: '+18% this quarter',
    animation: 'animate-float',
  },
  {
    icon: Brain,
    label: 'AI decisions',
    value: '12,847',
    change: 'Last 30 days',
    animation: 'animate-floatSlow',
  },
  {
    icon: Clock,
    label: 'Time saved',
    value: '340 hrs',
    change: 'Per month avg.',
    animation: 'animate-floatDelay',
  },
] as const

export function AuthBrandedPanel() {
  return (
    <div className="auth-branded-panel relative flex h-full min-h-screen flex-col overflow-hidden text-white">
      <SaiosAnimatedGradientBackdrop variant="dark" showGrid />

      <div className="relative z-10 flex flex-1 flex-col p-10 xl:p-14">
        {/* Brand lockup */}
        <SaiosBrandLockup surface="dark" href="/" priority />

        {/* Headline */}
        <div className="mt-10 max-w-md xl:mt-14">
          <h1 className="font-display text-3xl font-bold leading-[1.15] tracking-tight xl:text-[2.5rem]">
            Run your entire business{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #7ECAC3, #5BA8A0)' }}
            >
              through AI
            </span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            Unify intelligence, automation, and analytics in one enterprise operating system built for modern teams.
          </p>
        </div>

        {/* Testimonial pull-quote */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <div className="flex gap-0.5 mb-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="#5BA8A0">
                <path d="M8 1l1.8 3.6L14 5.3l-3 2.9.7 4.1L8 10.4l-3.7 1.9.7-4.1L2 5.3l4.2-.7z" />
              </svg>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-white/70 italic">
            "Cortex replaced five tools and an analyst role. Our team gets answers in seconds."
          </p>
          <p className="mt-3 text-xs font-semibold text-[#7ECAC3]">Priya Ramesh · COO, Meridian Logistics</p>
        </div>

        {/* Metric cards */}
        <div className="mt-auto flex flex-col gap-3 pt-12 xl:pt-16">
          {METRICS.map((metric) => (
            <div
              key={metric.label}
              className={cn(
                'flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm',
                'transition-colors hover:border-[#5BA8A0]/30 hover:bg-white/[0.08]',
                metric.animation,
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#5BA8A0]/20">
                <metric.icon className="h-5 w-5 text-[#7ECAC3]" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-white/50">
                  {metric.label}
                </p>
                <span className="font-display block text-xl font-bold text-white">{metric.value}</span>
              </div>
              <p className="shrink-0 text-xs font-semibold text-[#7ECAC3]">{metric.change}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="relative z-10 border-t border-white/8 px-10 py-5 text-xs text-white/30 xl:px-14">
        © {new Date().getFullYear()} Cortex — Enterprise AI Operating System
      </p>
    </div>
  )
}

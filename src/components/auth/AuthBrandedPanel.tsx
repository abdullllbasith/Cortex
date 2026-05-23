'use client'

import { Zap, TrendingUp, Brain, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

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
    <div className="auth-branded-panel relative flex h-full min-h-screen flex-col overflow-hidden bg-slate-950 text-white">
      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(#818cf8 1px, transparent 1px), linear-gradient(90deg, #818cf8 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute -left-32 top-0 h-[500px] w-[500px] rounded-full bg-indigo-600/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-[400px] w-[400px] rounded-full bg-violet-600/20 blur-3xl" />

      <div className="relative z-10 flex flex-1 flex-col p-10 xl:p-14">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-900/40">
            <Zap className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight text-white">SAIOS</span>
        </div>

        {/* Headline */}
        <div className="mt-10 max-w-md xl:mt-14">
          <h1 className="font-display text-3xl font-bold leading-[1.15] tracking-tight xl:text-[2.5rem]">
            Run your entire business through AI
          </h1>
          <p className="mt-4 text-base leading-relaxed">
            Unify intelligence, automation, and analytics in one enterprise operating system built for modern teams.
          </p>
        </div>

        {/* Metric cards — stacked grid, no overlap */}
        <div className="mt-auto flex flex-col gap-3 pt-12 xl:pt-16">
          {METRICS.map((metric) => (
            <div
              key={metric.label}
              className={cn(
                'flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm',
                'transition-colors hover:border-white/15 hover:bg-white/[0.08]',
                metric.animation,
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/25">
                <metric.icon className="h-5 w-5 text-indigo-300" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
                  {metric.label}
                </p>
                <span className="font-display block text-xl font-bold text-white">{metric.value}</span>
              </div>
              <p className="shrink-0 text-xs font-medium text-emerald-400">{metric.change}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="relative z-10 border-t border-white/5 px-10 py-5 text-xs text-slate-400 xl:px-14">
        © {new Date().getFullYear()} Softora · Enterprise AI Operating System
      </p>
    </div>
  )
}

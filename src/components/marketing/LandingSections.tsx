import Link from 'next/link'
import { ArrowRight, Bot, BarChart3, Workflow, Brain, Shield, Zap } from 'lucide-react'
import { Button } from '@/components/ui'
import { DashboardMockup } from './DashboardMockup'

const FEATURES = [
  { icon: Bot, title: 'AI Assistant', description: 'Natural language interface to query, act, and automate across every business function.' },
  { icon: BarChart3, title: 'Analytics Engine', description: 'Real-time dashboards, KPI tracking, and executive insights powered by your live data.' },
  { icon: Workflow, title: 'Workflow Automation', description: 'Build no-code automations that connect agents, triggers, and business rules.' },
  { icon: Brain, title: 'Predictive Intelligence', description: 'Forecast demand, detect anomalies, and surface risks before they impact revenue.' },
  { icon: Shield, title: 'Knowledge Base', description: 'Unified entity graph for customers, products, suppliers, and documents.' },
  { icon: Zap, title: 'Agent Orchestration', description: 'Deploy specialised AI agents that execute tasks autonomously with full audit trails.' },
]

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-16 sm:pt-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/40 via-transparent to-transparent dark:from-indigo-950/30" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-slate-100">
            Your entire business,{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              one AI conversation
            </span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            SAIOS unifies intelligence, automation, analytics, and knowledge into a single enterprise operating system — so your team can run smarter, not harder.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Start free trial
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg">Sign in</Button>
            </Link>
          </div>
        </div>

        <div className="mt-16">
          <DashboardMockup />
        </div>
      </div>
    </section>
  )
}

export function FeaturesSection() {
  return (
    <section id="features" className="border-t border-slate-200 bg-slate-50 px-6 py-20 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-100">
            Everything your business needs
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Six integrated modules that work together as one intelligent operating system.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950">
                <feature.icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SocialProofSection() {
  const logos = ['Meridian', 'Vertex Labs', 'Northwind', 'Apex Group', 'Summit Co']

  return (
    <section id="social" className="px-6 py-16">
      <div className="mx-auto max-w-6xl text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-slate-500">
          Trusted by 500+ businesses
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-8 sm:gap-12">
          {logos.map((name) => (
            <div
              key={name}
              className="flex h-10 items-center justify-center rounded-lg border border-slate-200 px-6 dark:border-slate-800"
            >
              <span className="font-display text-sm font-semibold text-slate-400">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

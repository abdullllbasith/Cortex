import Link from 'next/link'
import { ArrowRight, Bot, BarChart3, Workflow, Brain, Shield, Zap, Cloud, MessageSquare, Hexagon, FileText, Table, CreditCard, BookOpen, ShoppingBag, Target, MessageCircle, Mail } from 'lucide-react'
import { DashboardMockup } from './DashboardMockup'

const FEATURES = [
  {
    icon: Bot,
    title: 'AI Assistant',
    description: 'Natural language interface to query, act, and automate across every business function.',
  },
  {
    icon: BarChart3,
    title: 'Analytics Engine',
    description: 'Real-time dashboards, KPI tracking, and executive insights powered by your live data.',
  },
  {
    icon: Workflow,
    title: 'Workflow Automation',
    description: 'Build no-code automations that connect agents, triggers, and business rules.',
  },
  {
    icon: Brain,
    title: 'Predictive Intelligence',
    description: 'Forecast demand, detect anomalies, and surface risks before they impact revenue.',
  },
  {
    icon: Shield,
    title: 'Knowledge Base',
    description: 'Unified entity graph for customers, products, suppliers, and documents.',
  },
  {
    icon: Zap,
    title: 'Agent Orchestration',
    description: 'Deploy specialised AI agents that execute tasks autonomously with full audit trails.',
  },
]

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-20 sm:pt-28">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        {/* Soft teal radial glow top-left */}
        <div className="absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-[#7ECAC3]/15 blur-[100px]" />
        {/* Soft navy glow bottom-right */}
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-[#1E2D3D]/8 blur-[120px]" />
        {/* Fine grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(#1E2D3D 1px, transparent 1px), linear-gradient(90deg, #1E2D3D 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto mb-6 flex max-w-fit items-center gap-2 rounded-full border border-[#5BA8A0]/30 bg-[#5BA8A0]/10 px-4 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5BA8A0] animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-widest text-[#3D8E87]">
            Enterprise AI Operating System
          </span>
        </div>

        {/* Headline */}
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight text-[#1E2D3D] sm:text-5xl lg:text-[64px] lg:leading-[1.1] dark:text-white">
            Your entire business,{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #5BA8A0 0%, #7ECAC3 50%, #3D8E87 100%)',
              }}
            >
              one AI conversation
            </span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[#1E2D3D]/60 dark:text-white/60">
            SAIOS is Softora&apos;s enterprise AI operating system — unifying intelligence, automation,
            analytics, and knowledge so your team can run smarter, not harder.
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" style={{ textDecoration: 'none' }}>
              <button className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#5BA8A0] to-[#3D8E87] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#5BA8A0]/30 transition-all duration-200 hover:from-[#4D9990] hover:to-[#2F7D76] hover:shadow-xl hover:shadow-[#5BA8A0]/40 active:scale-[0.98]">
                Start free trial
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </Link>
            <Link href="/login" style={{ textDecoration: 'none' }}>
              <button className="inline-flex items-center gap-2 rounded-xl border border-[#1E2D3D]/15 bg-white px-6 py-3 text-sm font-semibold text-[#1E2D3D] shadow-sm transition-all duration-200 hover:border-[#5BA8A0]/50 hover:text-[#5BA8A0] hover:shadow-md dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:border-[#7ECAC3]/50 dark:hover:text-[#7ECAC3]">
                Sign in
              </button>
            </Link>
          </div>

          {/* Trust badges */}
          <p className="mt-6 text-xs text-[#1E2D3D]/40 dark:text-white/30">
            No credit card required · Free 14-day trial · SOC 2 Type II
          </p>


        </div>

        {/* Dashboard mockup */}
        <div className="mt-16">
          <DashboardMockup />
        </div>
      </div>
    </section>
  )
}

export function SocialProofSection() {
  const companies = [
    { name: 'Meridian', abbr: 'M' },
    { name: 'Vertex Labs', abbr: 'VL' },
    { name: 'Northwind', abbr: 'NW' },
    { name: 'Apex Group', abbr: 'AG' },
    { name: 'Summit Co', abbr: 'SC' },
    { name: 'Horizon AI', abbr: 'H' },
  ]

  return (
    <section id="social" className="px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#1E2D3D]/40 dark:text-white/30">
          Trusted by 500+ forward-thinking businesses
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {companies.map((co) => (
            <div
              key={co.name}
              className="flex h-10 items-center gap-2 rounded-lg border border-[#1E2D3D]/10 bg-white px-5 shadow-sm transition-all duration-200 hover:border-[#5BA8A0]/40 hover:shadow-md dark:border-white/10 dark:bg-white/5"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-[#7ECAC3] to-[#5BA8A0] text-[9px] font-bold text-white">
                {co.abbr[0]}
              </span>
              <span className="font-display text-sm font-semibold text-[#1E2D3D]/60 dark:text-white/50">
                {co.name}
              </span>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="mt-14 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            { value: '500+', label: 'Businesses' },
            { value: '12M+', label: 'Tasks automated' },
            { value: '99.9%', label: 'Uptime SLA' },
            { value: '<2s', label: 'AI response time' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div
                className="font-display text-3xl font-bold bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(135deg, #5BA8A0, #3D8E87)' }}
              >
                {stat.value}
              </div>
              <div className="mt-1 text-xs font-medium text-[#1E2D3D]/50 dark:text-white/40">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative border-t border-[#1E2D3D]/8 px-6 py-24 dark:border-white/8"
    >
      {/* Subtle background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#F0F7F6] to-white dark:from-[#0d1b2a] dark:to-[#0d1b2a]/50" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full border border-[#5BA8A0]/30 bg-[#5BA8A0]/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#3D8E87]">
            Platform capabilities
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-[#1E2D3D] dark:text-white">
            Everything your business needs
          </h2>
          <p className="mt-4 text-[#1E2D3D]/60 dark:text-white/50">
            Six integrated modules that work together as one intelligent operating system.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className="group relative rounded-2xl border border-[#1E2D3D]/8 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#5BA8A0]/40 hover:shadow-lg hover:shadow-[#5BA8A0]/10 dark:border-white/8 dark:bg-[#0d1b2a]/80 dark:hover:border-[#5BA8A0]/30"
            >
              {/* Top accent line on hover */}
              <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-[#7ECAC3] to-[#3D8E87] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: 'linear-gradient(135deg, #E8F5F4 0%, #D0EDEB 100%)' }}
              >
                <feature.icon
                  className="h-5 w-5"
                  style={{ color: '#3D8E87' }}
                />
              </div>
              <h3 className="font-display text-base font-semibold text-[#1E2D3D] dark:text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#1E2D3D]/55 dark:text-white/50">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── HOW IT WORKS ────────────────────────────────────────────────────────────

const STEPS = [
  {
    step: '01',
    title: 'Connect your business data',
    description:
      'Plug in your existing tools — CRM, ERP, spreadsheets, databases. SAIOS syncs everything in minutes with zero-code connectors.',
    detail: 'Supports 100+ integrations out of the box.',
  },
  {
    step: '02',
    title: 'Talk to your operating system',
    description:
      'Ask questions, trigger automations, and get insights using natural language — no dashboards to learn, no SQL to write.',
    detail: "Powered by Softora's proprietary AI layer.",
  },
  {
    step: '03',
    title: 'Automate & scale with agents',
    description:
      'Deploy AI agents that work 24/7 — processing orders, flagging anomalies, updating records, and sending reports automatically.',
    detail: 'Full audit trail on every action.',
  },
]

export function HowItWorksSection() {
  return (
    <section className="relative px-6 py-24">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#F0F7F6]/80 to-white dark:from-[#0d1b2a] dark:to-[#071018]" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full border border-[#5BA8A0]/30 bg-[#5BA8A0]/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#3D8E87]">
            How it works
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-[#1E2D3D] dark:text-white">
            Up and running in three steps
          </h2>
          <p className="mt-4 text-[#1E2D3D]/60 dark:text-white/50">
            From data chaos to AI-powered clarity — faster than you think.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.step} className="relative">
              {/* connector line */}
              {i < STEPS.length - 1 && (
                <div className="absolute top-8 left-full hidden h-px w-8 -translate-x-4 bg-gradient-to-r from-[#5BA8A0]/40 to-transparent lg:block" />
              )}

              <div className="group rounded-2xl border border-[#1E2D3D]/8 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#5BA8A0]/10 dark:border-white/8 dark:bg-[#0d1b2a]/80">
                {/* Step number */}
                <div
                  className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black text-white shadow-md"
                  style={{ background: 'linear-gradient(135deg, #5BA8A0, #3D8E87)' }}
                >
                  {s.step}
                </div>

                <h3 className="font-display text-lg font-semibold text-[#1E2D3D] dark:text-white">
                  {s.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#1E2D3D]/55 dark:text-white/50">
                  {s.description}
                </p>
                <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#5BA8A0]">
                  <span className="h-1 w-1 rounded-full bg-[#5BA8A0]" />
                  {s.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── INTEGRATIONS ─────────────────────────────────────────────────────────────

const INTEGRATIONS = [
  { name: 'Gmail', icon: Mail, status: 'available' as const },
  { name: 'Stripe', icon: CreditCard, status: 'available' as const },
  { name: 'Slack', icon: MessageSquare, status: 'available' as const },
  { name: 'WhatsApp', icon: MessageCircle, status: 'available' as const },
  { name: 'Salesforce', icon: Cloud, status: 'soon' as const },
  { name: 'HubSpot', icon: Hexagon, status: 'soon' as const },
  { name: 'Notion', icon: FileText, status: 'soon' as const },
  { name: 'Google Sheets', icon: Table, status: 'soon' as const },
  { name: 'QuickBooks', icon: BookOpen, status: 'soon' as const },
  { name: 'Zapier', icon: Zap, status: 'soon' as const },
  { name: 'Shopify', icon: ShoppingBag, status: 'soon' as const },
  { name: 'Jira', icon: Target, status: 'soon' as const },
]

export function IntegrationsSection() {
  return (
    <section className="relative border-t border-[#1E2D3D]/8 px-6 py-24 dark:border-white/8">
      {/* Decorative bg */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7ECAC3]/6 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full border border-[#5BA8A0]/30 bg-[#5BA8A0]/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#3D8E87]">
            Integrations
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-[#1E2D3D] dark:text-white">
            Works with your existing stack
          </h2>
          <p className="mt-4 text-[#1E2D3D]/60 dark:text-white/50">
            Connect the tools you already use. SAIOS becomes the intelligent layer across all of them.
          </p>
        </div>

        {/* Integration grid */}
        <div className="mt-14 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {INTEGRATIONS.map((tool) => (
            <div
              key={tool.name}
              className="group relative flex flex-col items-center gap-3 rounded-2xl border border-[#1E2D3D]/8 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#5BA8A0]/40 hover:shadow-lg hover:shadow-[#5BA8A0]/10 dark:border-white/8 dark:bg-[#0d1b2a]/80"
            >
              {tool.status === 'soon' && (
                <span className="absolute right-2 top-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  Soon
                </span>
              )}
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 transition-colors duration-300 group-hover:bg-[#5BA8A0]/10 dark:bg-[#163028]/30 dark:group-hover:bg-[#5BA8A0]/20">
                <tool.icon className="h-6 w-6 text-slate-400 transition-colors duration-300 group-hover:text-[#5BA8A0] dark:text-slate-500 dark:group-hover:text-[#7ECAC3]" strokeWidth={1.5} />
              </div>
              <span className="text-center text-[11px] font-semibold tracking-wide text-[#1E2D3D]/60 dark:text-white/50">
                {tool.name}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom label */}
        <p className="mt-8 text-center text-sm text-[#1E2D3D]/40 dark:text-white/30">
          Gmail, Stripe, Slack, and WhatsApp available today · More integrations on the roadmap
        </p>
      </div>
    </section>
  )
}

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote:
      "SAIOS replaced five separate tools and an analyst role. Our team now gets answers in seconds that used to take days of report pulling.",
    author: 'Priya Ramesh',
    role: 'COO, Meridian Logistics',
    avatar: 'PR',
    rating: 5,
  },
  {
    quote:
      "The AI assistant understood our business context out of the box. We automated 80% of our weekly operational reports within the first week.",
    author: 'James Okonkwo',
    role: 'Head of Operations, Apex Group',
    avatar: 'JO',
    rating: 5,
  },
  {
    quote:
      "Finally, a product that speaks business — not engineering. Every team member uses SAIOS daily, from sales to finance to HR.",
    author: 'Fatima Al-Hassan',
    role: 'CEO, Northwind Ventures',
    avatar: 'FA',
    rating: 5,
  },
]

export function TestimonialsSection() {
  return (
    <section className="relative border-t border-[#1E2D3D]/8 px-6 py-24 dark:border-white/8">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#F0F7F6]/60 to-white dark:from-[#0d1b2a]/80 dark:to-[#071018]" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full border border-[#5BA8A0]/30 bg-[#5BA8A0]/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#3D8E87]">
            Testimonials
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-[#1E2D3D] dark:text-white">
            Loved by operations teams
          </h2>
          <p className="mt-4 text-[#1E2D3D]/60 dark:text-white/50">
            Real results from businesses running smarter with SAIOS.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.author}
              className="relative flex flex-col rounded-2xl border border-[#1E2D3D]/8 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#5BA8A0]/10 dark:border-white/8 dark:bg-[#0d1b2a]/80"
            >
              {/* Quote mark */}
              <div
                className="mb-4 text-5xl font-black leading-none"
                style={{ color: '#5BA8A0', opacity: 0.25 }}
              >
                "
              </div>

              {/* Stars */}
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <svg key={i} className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="#5BA8A0">
                    <path d="M8 1l1.8 3.6L14 5.3l-3 2.9.7 4.1L8 10.4l-3.7 1.9.7-4.1L2 5.3l4.2-.7z" />
                  </svg>
                ))}
              </div>

              <p className="flex-1 text-sm leading-relaxed text-[#1E2D3D]/70 dark:text-white/60">
                "{t.quote}"
              </p>

              {/* Author */}
              <div className="mt-5 flex items-center gap-3 border-t border-[#1E2D3D]/6 pt-4 dark:border-white/6">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #5BA8A0, #3D8E87)' }}
                >
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#1E2D3D] dark:text-white">
                    {t.author}
                  </div>
                  <div className="text-xs text-[#1E2D3D]/50 dark:text-white/40">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── SECURITY & COMPLIANCE ────────────────────────────────────────────────────

const SECURITY_ITEMS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'SOC 2 Type II',
    description: 'Audited annually for security, availability, and confidentiality controls.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="11" width="18" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
    title: 'End-to-End Encryption',
    description: 'All data encrypted in transit (TLS 1.3) and at rest (AES-256).',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" strokeLinecap="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
      </svg>
    ),
    title: 'GDPR Compliant',
    description: 'Data residency controls and full right-to-erasure support for EU customers.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: '99.9% Uptime SLA',
    description: 'Enterprise-grade reliability with redundant infrastructure and 24/7 monitoring.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    title: 'RBAC & SSO',
    description: 'Granular role-based access control with SAML/OIDC single sign-on support.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    title: 'Full Audit Logs',
    description: 'Every agent action, data access, and user change is logged and exportable.',
  },
]

export function SecuritySection() {
  return (
    <section className="relative border-t border-[#1E2D3D]/8 px-6 py-24 dark:border-white/8">
      <div className="pointer-events-none absolute inset-0 bg-[#1E2D3D]" />

      {/* Decorative teal glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-[#5BA8A0]/10 blur-[100px]" />
        <div className="absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-[#3D8E87]/8 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full border border-[#5BA8A0]/30 bg-[#5BA8A0]/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#7ECAC3]">
            Security & Compliance
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-white">
            Enterprise-grade security, built in
          </h2>
          <p className="mt-4 text-white/50">
            Your data never trains our models. SAIOS is built for the enterprise with compliance and
            privacy as first-class citizens.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SECURITY_ITEMS.map((item) => (
            <div
              key={item.title}
              className="group rounded-2xl border border-white/8 bg-white/5 p-5 backdrop-blur-sm transition-all duration-300 hover:border-[#5BA8A0]/40 hover:bg-white/8"
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: 'linear-gradient(135deg, rgba(91,168,160,0.2), rgba(61,142,135,0.2))' }}
              >
                <span style={{ color: '#7ECAC3' }}>{item.icon}</span>
              </div>
              <h3 className="font-display text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">{item.description}</p>
            </div>
          ))}
        </div>

        {/* Trust bar */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-8">
          {['SOC 2 Type II', 'GDPR Ready', 'ISO 27001', 'HIPAA Compatible', 'CCPA Compliant'].map((badge) => (
            <div
              key={badge}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5"
            >
              <svg className="h-3 w-3 text-[#7ECAC3]" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1l1.5 3 3.3.5-2.4 2.3.6 3.2L8 8.5l-3 1.5.6-3.2L3.2 4.5l3.3-.5z" />
              </svg>
              <span className="text-xs font-semibold text-white/60">{badge}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── MID-PAGE CTA BANNER ──────────────────────────────────────────────────────

export function CTABannerSection() {
  return (
    <section className="relative overflow-hidden px-6 py-24">
      {/* Teal gradient bg */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(135deg, #5BA8A0 0%, #3D8E87 50%, #2A7A73 100%)' }}
      />
      {/* Noise texture overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
      />
      {/* Soft glows */}
      <div className="pointer-events-none absolute -top-20 -left-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-white/8 blur-3xl" />

      <div className="relative mx-auto max-w-4xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          Start today — no credit card required
        </div>

        <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">
          Ready to run your business <br className="hidden sm:block" />
          with AI?
        </h2>

        <p className="mt-6 text-lg leading-relaxed text-white/75">
          Join 500+ businesses already using SAIOS to automate operations,
          surface insights, and scale smarter.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register" style={{ textDecoration: 'none' }}>
            <span className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-[#3D8E87] shadow-lg transition-all duration-200 hover:bg-white/90 hover:shadow-xl active:scale-[0.98]">
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
          <Link href="/login" style={{ textDecoration: 'none' }}>
            <span className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:border-white/60 hover:bg-white/10 active:scale-[0.98]">
              Sign in to your account
            </span>
          </Link>
        </div>

        {/* Metrics row */}
        <div className="mt-12 grid grid-cols-3 gap-6 border-t border-white/20 pt-10">
          {[
            { val: '14 days', label: 'Free trial, no commitment' },
            { val: '< 5 min', label: 'Time to first AI insight' },
            { val: '24 / 7', label: 'Enterprise support included' },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <div className="font-display text-2xl font-bold text-white">{m.val}</div>
              <div className="mt-1 text-xs text-white/60">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}


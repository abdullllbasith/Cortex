# Cortex

**Enterprise AI Operating System** — *Your entire business, one AI conversation.*

Cortex unifies inventory, CRM/sales, finance, HR, analytics, knowledge, workflows, and specialized AI agents into a single multi-tenant workspace. Teams can query the business in natural language, act on insights (for example draft purchase orders), and plan ahead with predictions — instead of jumping across disconnected tools.

> Package name in this repo is `saios` (legacy internal name). The product brand is **Cortex**.

**Live production:** [cortex-gamma-teal.vercel.app](https://cortex-gamma-teal.vercel.app)

---

## Table of contents

- [Why Cortex](#why-cortex)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture overview](#architecture-overview)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Background workers](#background-workers)
- [Demo workspace](#demo-workspace)
- [Scripts reference](#scripts-reference)
- [Testing](#testing)
- [Deployment (Vercel)](#deployment-vercel)
- [Documentation](#documentation)
- [License](#license)

---

## Why Cortex

Most companies run on a stack of tools — inventory here, CRM there, finance somewhere else. Leaders spend time hunting for answers instead of making decisions.

Cortex solves that by putting the business in one AI-native operating system:

1. **Brief** — a daily AI executive briefing on the dashboard  
2. **Ask** — natural-language questions across modules via the Assistant  
3. **Act** — turn insight into operations (e.g. Reorder Centre → draft POs)  
4. **Forecast** — predictions for demand, stock risk, churn, and more  

---

## Features

### Core intelligence

| Module | Description | Primary routes |
|--------|-------------|----------------|
| **AI Executive Assistant** | Natural-language Q&A and actions across the business | `/assistant` |
| **Analytics Engine** | Real-time dashboards, KPIs, executive insights | `/analytics` |
| **Predictive Intelligence** | Demand, stock risk, churn, supplier risk | `/predictions` |
| **Knowledge Base** | Entity graph: customers, products, suppliers, documents + search | `/knowledge` |
| **Agent Orchestration** | Specialized agents (Inventory, Sales, Finance, Operations, Executive) | `/agents` |
| **Workflow Automation** | Visual no-code automations with executions | `/workflows` |

### Business modules

| Module | Highlights | Primary routes |
|--------|------------|----------------|
| **Dashboard** | KPIs + AI daily briefing | `/dashboard` |
| **Inventory** | Products, warehouses, stock, suppliers, POs, adjustments | `/inventory` |
| **Reorder Centre** | Low-stock urgency → supplier groups → draft purchase orders | `/inventory/reorder` |
| **CRM** | Contacts, pipeline, activities, CRM analytics | `/crm` |
| **Sales** | Quotes and orders | `/sales/quotes`, `/sales/orders` |
| **Finance** | Invoices, accounts, journals, reports, AR/AP aging | `/finance` |
| **HR** | Employees, leave, payroll | `/hr` |

### Platform

- Multi-tenant workspaces with plan tiers (`STARTER` / `PROFESSIONAL` / `ENTERPRISE`)
- Auth via Supabase + app JWT sessions, MFA, RBAC / custom roles
- Notifications, alerts, audit logs
- Settings: team, billing, branding, channels, webhooks, API keys, security
- Platform admin console (`/admin/*`) for tenants, support, feature flags, health
- Channel integrations: Gmail/SMTP, Stripe, Slack, WhatsApp
- Onboarding wizard (`/setup`) and demo-data loading

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | **Next.js 16** (App Router) |
| UI | **React 19**, **Tailwind CSS v4**, Radix UI, Lucide, TipTap, React Flow, Recharts |
| Language | **TypeScript 5** |
| Database | **PostgreSQL** (Supabase) + **pgvector** |
| ORM | **Prisma 6** (`pg` / `@prisma/adapter-pg`) |
| Auth | **Supabase Auth** + JWT sessions (`jose`), MFA (`otplib`) |
| AI | **OpenAI** / OpenRouter-compatible LLM provider; embeddings for knowledge |
| Queues | **BullMQ** + Redis (`ioredis`); optional **Upstash** for rate limiting |
| Storage | **Supabase Storage** (`uploads`, `documents`) |
| Forms / data | Zod, React Hook Form, SWR, TanStack Query, Zustand |
| Billing | Stripe webhooks |
| Testing | Jest, ts-jest, Supertest |
| Hosting | **Vercel** |

---

## Architecture overview

```text
┌─────────────────────────────────────────────────────────────┐
│  Browser (Next.js App Router)                               │
│  Marketing · Auth · Dashboard · Admin                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  API routes (`src/app/api/**`) + Proxy/Middleware           │
│  Tenant-scoped sessions · RBAC · rate limits                │
└───────┬─────────────────────┬───────────────────┬───────────┘
        │                     │                   │
        ▼                     ▼                   ▼
┌───────────────┐   ┌─────────────────┐   ┌──────────────────┐
│ PostgreSQL    │   │ Supabase        │   │ Redis / BullMQ   │
│ (Prisma)      │   │ Auth + Storage  │   │ (optional)       │
│ + pgvector    │   │                 │   │ Workers: agents, │
└───────────────┘   └─────────────────┘   │ reorder, ML, …   │
                                          └──────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │ LLM provider    │
                   │ (OpenAI / etc.) │
                   └─────────────────┘
```

- **Multi-tenancy:** domain data is scoped by `tenantId`.  
- **Serverless note:** the Next.js app runs on Vercel; BullMQ workers are **separate Node processes** and need Redis + their own host (or local terminals during development).  
- The app can run without Redis (queues/cache disabled); AI features need LLM keys.

---

## Project structure

```text
Cortex/
├── docs/                    # Product & demo documentation
├── prisma/                  # Schema, migrations, seeds
├── public/                  # Static assets
├── scripts/                 # Dev server helpers, storage setup, seed utilities
├── src/
│   ├── app/
│   │   ├── (marketing)/     # Landing, legal
│   │   ├── (auth)/          # Login, register, MFA, password reset
│   │   ├── (dashboard)/     # Main product UI
│   │   ├── (onboarding)/    # Workspace setup
│   │   ├── (admin)/         # Platform admin
│   │   └── api/             # REST API routes
│   ├── components/          # UI and feature components
│   ├── hooks/
│   ├── lib/                 # Agents, queues, auth, seed, LLM, domain logic
│   ├── middleware/
│   ├── providers/
│   ├── store/
│   ├── styles/
│   └── types/
├── package.json             # name: saios
├── next.config.ts
├── AGENTS.md                # Cursor/Next.js agent rules
└── .env.example
```

---

## Prerequisites

- **Node.js** 20+ (Vercel project currently uses Node 24.x)
- **npm** (repo uses npm lockfile)
- **PostgreSQL** via a Supabase project (or compatible Postgres with `pgvector`)
- **Supabase** project (Auth + Storage)
- Optional: **Redis** for BullMQ workers and caching
- Optional: **OpenAI** / OpenRouter API key for Assistant, briefing, embeddings, agents

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/abdullllbasith/Cortex.git
cd Cortex
npm install
```

`postinstall` runs `prisma generate` automatically.

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in at least:

- `DATABASE_URL` and `DIRECT_URL` (Supabase pooler URLs)
- `JWT_SECRET` (32+ characters in production)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (or OpenRouter / `LLM_*` equivalents) for AI features
- `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`)

See [Environment variables](#environment-variables) for the full list.

### 3. Database

```bash
npm run db:migrate:dev   # apply migrations (local)
npm run db:seed          # optional: sample tenants + baseline data
npm run setup:storage    # create Supabase storage buckets
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful variants:

```bash
npm run dev:turbo    # Turbopack
npm run dev:fresh    # clean Next cache, then start
```

### 5. Optional workers

In separate terminals (requires `REDIS_URL`):

```bash
npm run worker:agents
npm run worker:reorder
npm run worker:workflows
# …see Scripts reference
```

---

## Environment variables

Canonical template: [`.env.example`](.env.example).

### Required for a working local app

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma runtime URL (Supabase transaction pooler `:6543`, `pgbouncer=true`) |
| `DIRECT_URL` | Migrations / session pooler (`:5432`) |
| `JWT_SECRET` | App session signing |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access |
| `NEXT_PUBLIC_APP_URL` | App origin |
| `NEXT_PUBLIC_API_URL` | Usually `/api` |

### Strongly recommended

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Assistant, embeddings, agents |
| `OPENAI_ASSISTANT_MODEL` | Override chat model (default in example: `gpt-4o-mini`) |
| `AUTH_DEV_MODE` | `true` for local JWT bypass (never in production) |
| `ENCRYPTION_MASTER_KEY` | Tenant field encryption (falls back to `JWT_SECRET` in dev) |

### Optional integrations

| Area | Variables |
|------|-----------|
| Redis / queues | `REDIS_URL` |
| Upstash rate limit | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| LLM alternatives | `OPENROUTER_API_KEY`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_CHAT_MODELS`, `EMBEDDING_MODEL`, … |
| Email | `SMTP_*` and/or `SENDGRID_*` |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` |
| Slack | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Web push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| Platform admin | `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD`, `ADMIN_IP_ALLOWLIST` |
| Demo UI | `NEXT_PUBLIC_DEMO_EMAIL`, `NEXT_PUBLIC_DEMO_PASSWORD`, `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS` |
| Storage buckets | `NEXT_PUBLIC_SUPABASE_UPLOAD_BUCKET`, `NEXT_PUBLIC_SUPABASE_DOCUMENT_BUCKET` |

**Supabase Auth redirect URLs** (Auth → URL Configuration):

- `http://localhost:3000/auth/confirm`
- `http://localhost:3000/reset-password`
- Same paths on your production domain

---

## Database

- **Provider:** PostgreSQL on Supabase  
- **Extensions:** `pgvector` for knowledge embeddings  
- **ORM:** Prisma (`prisma/schema.prisma`)

| Command | Use |
|---------|-----|
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate:dev` | Create/apply migrations locally |
| `npm run db:migrate` | `prisma migrate deploy` (CI / production) |
| `npm run db:check` | Connectivity check |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Seed sample tenants (`acme-corp`, `globex`, `initech`, …) |
| `npm run db:seed:demo` | Rich demo dataset for a workspace |
| `npm run db:seed:user` | Demo user-focused seed |
| `npm run db:seed:hr` | HR-only seed |

All business data is **tenant-scoped**. Platform operators manage tenants from `/admin`.

---

## Background workers

Workers process async jobs via BullMQ. Start only what you need; each requires Redis.

| Script | Responsibility |
|--------|----------------|
| `npm run worker:agents` | Agent task execution |
| `npm run worker:analytics` | Analytics snapshots |
| `npm run worker:ml` | ML / prediction features |
| `npm run worker:workflows` | Workflow executions |
| `npm run worker:reorder` | Reorder / inventory jobs |
| `npm run worker:invoice-overdue` | Overdue invoice processing |
| `npm run worker:follow-up` | Follow-up jobs |
| `npm run worker:notifications` | Notification delivery |

---

## Demo workspace

For presentations and local demos:

1. Ensure migrations are applied and AI keys are set  
2. Seed or load demo data:
   - Dashboard **Load demo data**, or  
   - `/setup`, or  
   - `npm run db:seed:demo` / `npm run db:seed:user`  
3. Sign in via `/login`

Demo credential panel on auth pages (overridable):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_DEMO_EMAIL` | Demo login email (default: `demo@saios.app`) |
| `NEXT_PUBLIC_DEMO_PASSWORD` | Demo password |
| `NEXT_PUBLIC_DEMO_LABEL` | Label shown in the UI |
| `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS` | Set `false` to hide the panel |

See [`docs/VIDEO_PRESENTATION_GUIDE.md`](docs/VIDEO_PRESENTATION_GUIDE.md) for a full 4–5 minute demo script (problem → solution → walkthrough).

---

## Scripts reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Development server |
| `npm run dev:turbo` | Dev with Turbopack |
| `npm run dev:clean` | Clear Next.js cache |
| `npm run dev:fresh` | Clean cache + start dev |
| `npm run build` | `prisma generate && next build` |
| `npm start` | Production Next server |
| `npm run lint` | ESLint |
| `npm test` | Jest |
| `npm run test:watch` | Jest watch mode |
| `npm run setup:storage` | Ensure Supabase storage buckets |

---

## Testing

```bash
npm test
npm run test:watch
```

Tests live under `src/**/__tests__/**/*.test.ts` (assistant, embeddings, intent classification, and related units).

---

## Deployment (Vercel)

This repo is linked to the Vercel project **`cortex`**.

### Deploy from CLI

```bash
npx vercel link --yes --project cortex
npx vercel deploy --prod --yes
```

### Production checklist

1. Set all required env vars in the Vercel project (Production + Preview as needed)  
2. Use Supabase **transaction pooler** for `DATABASE_URL` (serverless-friendly)  
3. Run migrations against production with `DIRECT_URL`:  
   `npm run db:migrate`  
4. Run `npm run setup:storage` once against the production Supabase project  
5. Host Redis + `worker:*` processes separately if you need queues/agents/reorder jobs  
6. Disable `AUTH_DEV_MODE` in production  
7. Configure Supabase Auth redirect URLs for the production domain  
8. Set strong `JWT_SECRET`, `PLATFORM_ADMIN_*`, and Stripe secrets  

**Current production alias:** [https://cortex-gamma-teal.vercel.app](https://cortex-gamma-teal.vercel.app)

---

## Documentation

| Doc | Description |
|-----|-------------|
| [`docs/VIDEO_PRESENTATION_GUIDE.md`](docs/VIDEO_PRESENTATION_GUIDE.md) | Demo roadmap, script, timing, gotchas |
| [`docs/SALES_EVENT_AUDIT.md`](docs/SALES_EVENT_AUDIT.md) | Sales event emission paths for analytics |
| [`AGENTS.md`](AGENTS.md) | Agent guidance for this Next.js version |
| [`.env.example`](.env.example) | Environment variable template |

---

## License

Private project (`"private": true` in `package.json`). All rights reserved unless otherwise stated by Softora / the repository owners.

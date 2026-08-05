# Cortex Video Presentation Guide

**Duration:** 4:30–5:00  
**Story arc:** Problem → Solution → Why now → Ask → See → Act → Forecast  
**Demo start:** Landing (`/`)  
**Demo end:** Predictions (`/predictions`) — or Analytics (`/analytics`) if forecasts look empty  

---

## Product pitch

**Cortex** is an enterprise AI operating system — *your entire business, one AI conversation*. It unifies inventory, CRM/sales, finance, HR, analytics, knowledge, workflows, and specialized AI agents so teams can query and act across the business in natural language.

---

## Full roadmap

```text
[0:00] PROBLEM / SOLUTION / WHY NOW     ← Slide / voiceover only (no app yet)
   │  Fragmented tools → one AI OS → speed of this era
   ▼
[0:45] START DEMO ── Landing (/)
   │  Brand + “one AI conversation”
   ▼
[1:20] Login (/login)
   │  Demo account
   ▼
[1:40] Dashboard (/dashboard)
   │  KPIs + AI daily briefing
   ▼
[2:35] Assistant (/assistant)           ← HERO MOMENT
   │  Cross-module Q&A
   ▼
[3:45] Reorder (/inventory/reorder)
   │  Insight → draft PO
   ▼
[4:25] Predictions (/predictions)       ← CLOSE
   │  Forecast / risk / next moves
   ▼
[4:50] END — tagline + CTA
```

**Skip if short on time:** Workflows, Agents, Knowledge, CRM deep-dives.  
**Optional close swap:** `/analytics` instead of `/predictions`.

---

## Timing cheat sheet

| Segment | Time | Route / surface | Job |
|--------|------|-----------------|-----|
| Problem → Solution → Why now | 0:00–0:45 | Title slide / VO | Frame the need |
| Landing | 0:45–1:20 | `/` | Position the product |
| Login | 1:20–1:40 | `/login` | Enter workspace |
| Dashboard | 1:40–2:35 | `/dashboard` | Briefing + KPIs |
| Assistant | 2:35–3:45 | `/assistant` | Hero demo |
| Reorder | 3:45–4:25 | `/inventory/reorder` | Action |
| Predictions + close | 4:25–5:00 | `/predictions` | End the loop |

---

## Pre-demo checklist

Do this ~30 seconds before you hit record:

1. Logged out, browser ready on `/` (or title slide first)
2. Demo data loaded — dashboard KPIs and charts are not empty
3. AI keys working — briefing and assistant respond
4. MFA off for the demo account
5. Demo credentials ready
6. Bookmarks/tabs ready: `/` → `/dashboard` → `/assistant` → `/inventory/reorder` → `/predictions`

**Demo credentials (defaults):** `demo@saios.app` / `Demo@SAIOS2026`  
(Overridable via `NEXT_PUBLIC_DEMO_*`; hide with `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=false`.)

**If workspace is empty:** use “Load demo data” on the dashboard, complete `/setup`, or run seed scripts (`npm run db:seed:demo` / `db:seed:user`).

---

## Cold open (0:00–0:45) — before the demo

**On screen:** Dark title slide (no app UI yet)  
**Title options:**

- “Too many tools. Not enough decisions.”
- “Your business is fragmented. Your AI shouldn’t be.”

### 1) The problem (~15s)

> “Most companies run on a stack of tools — inventory here, CRM there, finance somewhere else, reports in another tab. Leaders spend their mornings hunting for answers instead of making decisions. Data is everywhere. Clarity isn’t.”

### 2) How Cortex solves it (~15s)

> “Cortex is an enterprise AI operating system. It brings those systems into one workspace you can talk to — ask what’s at risk, what’s moving, and what to do next — then act, from briefing to reorder to forecast, without jumping across five apps.”

### 3) Why it matters in this era (~15s)

> “We’re in an AI era where speed is the advantage. Companies that still operate tool-by-tool will fall behind. The winners won’t just have dashboards — they’ll have a business they can ask, that answers, and that helps them act in real time.”

### Transition into demo

> “Let me show you what that looks like.”

→ Cut to Landing (`/`).

---

## Minute-by-minute demo script

### 0:45–1:20 — Landing (START DEMO)

**Do:** Full-bleed hero. Optional light scroll over features. Don’t linger on pricing.

**Say:**

> “This is Cortex — an enterprise AI operating system. The idea is simple: your entire business, one AI conversation. Inventory, sales, finance, analytics — not five tools, one workspace you can talk to.”

**On screen:** Brand, hero line, Sign in CTA.

---

### 1:20–1:40 — Login

**Do:** Open `/login` → sign in with the demo account. Don’t narrate form fields.

**Say:**

> “I’ll jump into a live workspace.”

---

### 1:40–2:35 — Dashboard

**Do:** Hover the KPI strip (revenue, orders, pipeline, low stock). Pause on the **AI daily briefing** — wait until it loads. Use a briefing CTA into Assistant if available.

**Say:**

> “After login, you don’t just get charts. Cortex briefs you — what’s moving, what’s at risk, what to do next. That briefing is the daily command center.”

**Point to:** 1–2 priority actions or risks in the briefing.

---

### 2:35–3:45 — Assistant (HERO)

**Do:** Open `/assistant`. Click a suggestion chip **or** ask one strong question:

- “Give me my daily executive briefing”
- “What’s low on stock?”
- “Summarize the sales pipeline”

Wait for the answer. Optionally ask one short follow-up.

**Say:**

> “This is the core. I’m not searching modules — I’m asking the business. Cortex pulls across inventory, CRM, finance, and turns it into something an executive can act on.”

**Camera tip:** Stay here longest. This is the moment viewers remember.

---

### 3:45–4:25 — Reorder Centre (ACT)

**Do:** Open `/inventory/reorder`. Show critical/warning items, supplier grouping, suggested quantity. If safe, generate a **draft PO** (don’t place a real order).

**Say:**

> “When stock is the risk, insight becomes action. Reorder Centre groups low-stock items by supplier and drafts the purchase order — so the AI doesn’t just warn you, it helps you fix it.”

---

### 4:25–5:00 — Predictions + close (END)

**Do:** Open `/predictions` (or `/analytics`). Briefly show demand, stock risk, or churn. Stop. Face camera or hold the final screen.

**Say:**

> “And then it looks ahead — demand, stock risk, churn — so you’re not only reacting today, you’re planning tomorrow.”

**Closing line (ties back to the open):**

> “That’s Cortex — not another dashboard, but one place to ask, act, and plan. In this era, the business that can think together, wins.”

**Optional CTA (~5s):**

> “Try the workspace — start with the assistant, and run the business from one conversation.”

---

## One-line spine (if you freeze)

1. **Problem:** Tools are scattered; decisions are slow.
2. **Solution:** Cortex — whole business, one AI conversation.
3. **Why now:** Speed and AI advantage decide who wins.
4. Dashboard briefs you.
5. Assistant answers across modules.
6. Reorder turns risk into a PO.
7. Predictions close the loop.

---

## Demo-able features & routes

| Feature | Why it demos well | Route |
|--------|-------------------|--------|
| Landing | Brand, hero, features, pricing CTA | `/` |
| Login / Register | Auth entry; demo credentials | `/login`, `/register` |
| Workspace setup | Onboarding (new tenants) | `/setup` |
| Master dashboard | KPIs + AI daily briefing | `/dashboard` |
| AI Executive Assistant | Natural-language Q&A / actions | `/assistant` |
| Inventory | Ops dashboard | `/inventory` |
| Reorder Centre | Low-stock → supplier groups → draft POs | `/inventory/reorder` |
| Products / POs / Suppliers | Deeper ops (optional) | `/inventory/products`, `/inventory/purchase-orders`, `/inventory/suppliers` |
| Analytics | Executive scorecards | `/analytics` |
| Predictions | Forecast, stock risk, churn, supplier risk | `/predictions` |
| Agents | Finance / Sales / Inventory / Ops / Executive | `/agents` |
| Workflows | Visual automation builder | `/workflows` |
| Knowledge Base | Customers, products, suppliers, docs | `/knowledge` |
| CRM / Sales / Finance / HR | Full business modules | `/crm`, `/sales/quotes`, `/finance`, `/hr` |
| Settings | Team, roles, billing, branding | `/settings` |

**Marketing anchors:** `#features`, `#pricing`, `#social`  
**Power-user:** ⌘K command palette from the top bar  

---

## On-camera rules

- One story only: **brief → ask → act → forecast**
- Don’t open Settings, Admin, or empty modules
- If briefing is slow, talk over KPIs, then cut to Assistant
- Prefer one strong assistant answer over three weak ones
- End on Predictions/Analytics — don’t wander back to Landing
- Use the brand name **Cortex** on camera (package/code may still say SAIOS)

---

## Demo gotchas

| Gotcha | Detail |
|--------|--------|
| Auth required | Most app routes redirect to `/login`. Public: `/`, auth pages, `/legal/*`. |
| Empty workspace | Charts/KPIs can be empty — load demo data before recording. |
| AI / workers | Briefing & assistant need LLM keys. Some features may need Redis/BullMQ workers. |
| MFA | If enabled, flow goes through `/mfa/verify` — disable for demos. |
| Briefing latency | Dashboard briefing may show “Preparing…” — wait or refresh before talking over it. |
| Admin vs tenant | `/admin/*` is a separate platform admin login — not the customer journey. |

---

## Teleprompter-only version (word-for-word)

> Most companies run on a stack of tools — inventory here, CRM there, finance somewhere else, reports in another tab. Leaders spend their mornings hunting for answers instead of making decisions. Data is everywhere. Clarity isn’t.
>
> Cortex is an enterprise AI operating system. It brings those systems into one workspace you can talk to — ask what’s at risk, what’s moving, and what to do next — then act, from briefing to reorder to forecast, without jumping across five apps.
>
> We’re in an AI era where speed is the advantage. Companies that still operate tool-by-tool will fall behind. The winners won’t just have dashboards — they’ll have a business they can ask, that answers, and that helps them act in real time.
>
> Let me show you what that looks like.
>
> This is Cortex — an enterprise AI operating system. The idea is simple: your entire business, one AI conversation. Inventory, sales, finance, analytics — not five tools, one workspace you can talk to.
>
> I’ll jump into a live workspace.
>
> After login, you don’t just get charts. Cortex briefs you — what’s moving, what’s at risk, what to do next. That briefing is the daily command center.
>
> This is the core. I’m not searching modules — I’m asking the business. Cortex pulls across inventory, CRM, finance, and turns it into something an executive can act on.
>
> When stock is the risk, insight becomes action. Reorder Centre groups low-stock items by supplier and drafts the purchase order — so the AI doesn’t just warn you, it helps you fix it.
>
> And then it looks ahead — demand, stock risk, churn — so you’re not only reacting today, you’re planning tomorrow.
>
> That’s Cortex — not another dashboard, but one place to ask, act, and plan. In this era, the business that can think together, wins.
>
> Try the workspace — start with the assistant, and run the business from one conversation.

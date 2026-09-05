# Cortex Video Presentation Guide

**Duration:** 4:30–5:00  
**Story arc:** Problem → Solution → Why now → Ask → See → Act → Forecast  
**Demo start:** Landing (`/`)  
**Demo end:** Predictions (`/predictions`) — or Analytics (`/analytics`) if forecasts look empty  

---

## Product pitch

**Cortex** is an enterprise AI operating system — *your entire business, one AI conversation*. It unifies inventory, CRM/sales, finance, HR, analytics, knowledge, workflows, and specialized AI agents so teams can query and act across the business in natural language.

---

## Full roadmap (expanded tour)

Use this when you have ~8–10 minutes. The short 5-minute spine is still: Landing → Login → Dashboard → Assistant → Reorder → Predictions.

```text
[0:00] PROBLEM / SOLUTION / WHY NOW     ← Slide / voiceover only
   │
[0:45] Landing (/)
   │
[1:15] Login (/login)
   │
[1:30] Dashboard (/dashboard)           ← KPIs + AI daily briefing
   │
[2:10] AI Executive Assistant (/assistant)   ← HERO #1
   │
[3:00] Knowledge Base (/knowledge)      ← HERO #2 — fuel for AI
   │
[3:40] Multi-Agent Control (/agents)    ← HERO #3 — how specialists work
   │
[4:40] Workflows (/workflows)           ← HERO #4 — pre-built template
   │
[5:25] Inventory + Reorder              ← normal pass (act)
   │
[5:55] CRM / Sales / Finance            ← normal pass (business)
   │
[6:25] Predictions + Analytics + HR     ← normal pass (look ahead / people)
   │
[6:55] Team invite (/settings/team)     ← how owner brings people in
   │
[7:25] Close — tagline + CTA
```

**If short on time (~5 min):** keep Landing → Dashboard → Assistant → Agents (30s) → Reorder → Predictions. Mention Knowledge + Workflows in VO only.  
**Optional close swap:** `/analytics` instead of `/predictions`.

---

## Timing cheat sheet


| Segment                         | Time      | Route / surface      | Job                                      |
| ------------------------------- | --------- | -------------------- | ---------------------------------------- |
| Problem → Solution → Why now    | 0:00–0:45 | Title slide / VO     | Frame the need                           |
| Landing                         | 0:45–1:15 | `/`                  | Position the product                     |
| Login                           | 1:15–1:30 | `/login`             | Enter workspace                          |
| Dashboard                       | 1:30–2:10 | `/dashboard`         | Briefing + KPIs                          |
| AI Executive Assistant          | 2:10–3:00 | `/assistant`         | Hero — ask the business                  |
| Knowledge Base                  | 3:00–3:40 | `/knowledge`         | Hero — what AI learns from               |
| Multi-Agents                    | 3:40–4:40 | `/agents`            | Hero — specialists + orchestration       |
| Workflows                       | 4:40–5:25 | `/workflows`         | Hero — pre-built automation template     |
| Inventory + Reorder             | 5:25–5:55 | `/inventory/reorder` | Insight → draft PO                       |
| CRM / Sales / Finance           | 5:55–6:25 | `/crm`, `/sales`, `/finance` | Business modules (light)          |
| Predictions / Analytics / HR    | 6:25–6:55 | `/predictions`, `/hr`| Forecast + people (light)                |
| Team invite                     | 6:55–7:25 | `/settings/team`     | Owner brings the company in              |
| Close                           | 7:25–7:45 | Final screen         | Tagline + CTA                            |


---

## Pre-demo checklist

Do this ~30 seconds before you hit record:

1. Logged out, browser ready on `/` (or title slide first)
2. Demo data loaded — dashboard KPIs, knowledge tabs, agents, and workflows are not empty
3. AI keys working — briefing, assistant, and agents respond
4. MFA off for the demo account
5. Demo credentials ready
6. Bookmarks/tabs ready: `/` → `/dashboard` → `/assistant` → `/knowledge` → `/agents` → `/workflows` → `/inventory/reorder` → `/predictions` → `/settings/team`

**Demo credentials (defaults):** `demo@saios.app` / `Demo@SAIOS2026`  
(Overridable via `NEXT_PUBLIC_DEMO_`*; hide with `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=false`.)

**If workspace is empty:** use “Load demo data” on the dashboard, complete `/setup`, or run seed scripts (`npm run db:seed:demo` / `db:seed:user`).

**Workflow tip:** On `/workflows`, open templates and have **Procure to Pay** or **Order to Cash** ready to show (don’t invent a blank graph live).

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

### 0:45–1:15 — Landing (START DEMO)

**Do:** Full-bleed hero. Optional light scroll over features. Don’t linger on pricing.

**Say:**

> “This is Cortex — an enterprise AI operating system. The idea is simple: your entire business, one AI conversation. Inventory, sales, finance, knowledge, agents, workflows — not five tools, one workspace you can talk to.”

**On screen:** Brand, hero line, Sign in CTA.

---

### 1:15–1:30 — Login

**Do:** Open `/login` → sign in with the demo account. Don’t narrate form fields.

**Say:**

> “I’ll jump into a live workspace.”

---

### 1:30–2:10 — Dashboard

**Do:** Hover the KPI strip (revenue, orders, pipeline, low stock). Pause on the **AI daily briefing** — wait until it loads. Use a briefing CTA into Assistant if available.

**Say:**

> “After login, you don’t just get charts. Cortex briefs you — what’s moving, what’s at risk, what to do next. That briefing is the daily command center.”

**Point to:** 1–2 priority actions or risks in the briefing.

---

### 2:10–3:00 — AI Executive Assistant (HERO #1)

**Do:** Open `/assistant`. Click a suggestion chip **or** ask one strong question:

- “Give me my daily executive briefing”
- “What’s low on stock?”
- “Summarize the sales pipeline”
- “What is our AR and AP position?”

Wait for the answer. Optionally ask one short follow-up. Show that answers can cite live ERP data and knowledge sources.

**Say:**

> “This is the AI Executive Assistant — the front door. I’m not searching modules — I’m asking the business. It pulls across inventory, CRM, finance, and the knowledge base, and turns it into something an executive can act on. Query, report, forecast, even start an action — with confirmation when it matters.”

**Camera tip:** Stay here until one complete, strong answer lands. This is the moment viewers remember.

---

### 3:00–3:40 — Knowledge Base (HERO #2)

**Do:** Open `/knowledge` (Knowledge Engine). Quickly show tabs: **Customers**, **Products**, **Suppliers**, **Business Documents**. Open documents and mention upload types (PDF, DOCX, CSV, TXT). If a doc is indexed, note that it becomes searchable by AI.

**Say:**

> “Agents and the assistant are only as good as what they know. The Knowledge Base is that memory — customer profiles, product catalog, supplier performance, plus policies, SOPs, contracts, and reports. Everything gets embedded for semantic search, so when you ask a question, Cortex isn’t guessing — it’s retrieving from your real business knowledge.”

**Point to:** One customer/product tab + one business document. One line: “This is what feeds the agents.”

---

### 3:40–4:40 — Multi-Agent Control Center (HERO #3)

**Do:** Open `/agents`. Show the five agent cards. Optionally open one detail page (e.g. Inventory or Executive) and, if the thought stream is active, let it run briefly. Do **not** deep-dive every tool.

**Explain multi-agents clearly on camera:**

> “Cortex doesn’t use one generic chatbot for everything. It runs specialized agents — each with a real job.”

| Agent            | Role on camera (one line)                                      |
| ---------------- | -------------------------------------------------------------- |
| Finance Agent    | CFO AI — AR/AP, invoices, P&L, payments                        |
| Sales Agent      | Sales director — pipeline, leads, quotes, follow-ups           |
| Inventory Agent  | Supply chain — stock, EOQ reorder, POs, receiving              |
| Operations Agent | HR ops — headcount, leave, attendance, policies                |
| Executive Agent  | CEO advisor — daily briefing, business health, **delegates**   |

**Say (orchestration — the key beat):**

> “Here’s how multi-agent works. You give a task. The orchestrator routes it — finance questions to Finance, stock to Inventory, and so on. Bigger, cross-functional asks go to the Executive Agent. That agent can delegate to the specialists, pull their answers, and synthesize one executive view. So you’re not managing five chats — you’re running a small AI leadership team that coordinates.”

**Optional live ask on Agents page / via Assistant:**

- “What’s our business health this week?” (Executive path)
- Or open Inventory Agent and show a low-stock / reorder style task

**Camera tip:** Spend time on *how they work together*, not listing every button.

---

### 4:40–5:25 — Workflows + pre-built template (HERO #4)

**Do:** Open `/workflows` → open **Templates** (don’t build from blank). Pick **one** short, clear template and walk the trigger → steps → outcome.

**Recommended demo template (pick one):**

1. **Procure to Pay** — when stock hits reorder point → AI decision → create PO or alert manager  
2. **Order to Cash** — order delivered → inventory sale → invoice → reminders → escalate if unpaid  
3. **Lead to Deal** — new lead → welcome → tasks → offer → re-engagement  

**Say (while showing Procure to Pay or Order to Cash):**

> “Workflows are the automation layer. Cortex ships with pre-built templates — not empty canvases. Here’s Procure to Pay: stock drops below reorder, the workflow decides whether to auto-create a purchase order or alert a manager. Trigger, conditions, actions — already wired across inventory and finance. Same idea for order-to-cash, lead-to-deal, month-end close, onboarding. You start from a working template, then tune it.”

**Point to:** Trigger node → one decision/action → end state. Keep it under 45 seconds.

---

### 5:25–5:55 — Inventory + Reorder Centre (normal pass)

**Do:** Brief glance at `/inventory` KPIs if useful, then open `/inventory/reorder`. Show critical/warning items, supplier grouping, suggested quantity. If safe, generate a **draft PO** (don’t place a real order).

**Say:**

> “Operations side — inventory health, products, suppliers, warehouses. When stock is the risk, Reorder Centre groups low-stock items by supplier and drafts the purchase order — so insight becomes action.”

---

### 5:55–6:25 — CRM, Sales, Finance (normal pass)

**Do:** Quick hops only — don’t deep-dive forms.

1. `/crm` — pipeline value, open deals, or pipeline board  
2. `/sales/quotes` or `/sales/orders` — quote → order path  
3. `/finance` — revenue/expenses, AR/AP aging, invoices  

**Say:**

> “Same workspace for the commercial and finance side. CRM for contacts and pipeline. Sales for quotes and orders. Finance for invoices, ledger, AR and AP. The assistant and the sales/finance agents sit on top of this — so asking ‘what’s stuck in the pipeline?’ or ‘what’s overdue in AR?’ is grounded in live modules.”

---

### 6:25–6:55 — Predictions, Analytics, HR (normal pass)

**Do:**

1. `/predictions` — sales forecast, inventory risk, churn, supplier risk (pick 1–2 panels)  
2. Optional 5s on `/analytics` scorecards  
3. Optional 5s on `/hr` — headcount / leave / payroll overview  

**Say:**

> “Cortex also looks ahead — demand, stock risk, churn, supplier risk — and analytics for executive scorecards. People ops live under HR: employees, leave, payroll. The Operations Agent works that layer when you ask in natural language.”

**If predictions look empty:** swap to `/analytics` and keep the same “look ahead / measure” beat.

---

### 6:55–7:25 — Owner invites team members

**Do:** Open `/settings/team` → open **Invite team members**. Show emails + role picker (CEO, Manager, Finance Officer, Sales Officer, Employee). Don’t send a real invite unless you intend to. Mention 48-hour expiry and seat limits if on screen.

**Say:**

> “How the company actually gets on Cortex: the owner opens Team settings, invites people by email, assigns a role, and sends. The invitee gets a link, sets a password, and lands in the workspace — same dashboard, same assistant, permissions matching their role. That’s how you go from a solo owner account to a real team.”

**Flow to mention (10 seconds):**

1. Owner → Settings → Team → Invite  
2. Emails + role (+ optional message)  
3. Invitee opens `/invite/[token]` → sets password → dashboard  

---

### 7:25–7:45 — Close

**Do:** Hold Predictions, Agents, or Assistant. Face camera or hold the final screen.

**Say:**

> “That’s Cortex — knowledge that feeds the AI, specialized agents that coordinate, an executive assistant you can talk to, workflows that already work out of the box, and the full business underneath. Not another dashboard — one place to ask, act, and plan. In this era, the business that can think together, wins.”

**Optional CTA (~5s):**

> “Try the workspace — start with the assistant, open the agents, and run the business from one conversation.”

---

## What to emphasize (priority)

1. **AI Executive Assistant** — ask the whole business in natural language  
2. **Knowledge Base** — customers, products, suppliers, docs → semantic memory for AI  
3. **Multi-Agents** — Finance / Sales / Inventory / Operations / Executive; Executive delegates and synthesizes  
4. **Workflows** — show one pre-built template end-to-end (Procure to Pay or Order to Cash)  
5. **Reorder** — insight → draft PO (best “act” moment)  
6. **Invite** — owner → team → roles  
7. Everything else (CRM, sales, finance, predictions, analytics, HR) — short, confident passes  

---

## Multi-agent one-liner (if you freeze)

> “Five specialists. One orchestrator. Executive can delegate. You get one answer, not five silos.”

---

## One-line spine (if you freeze)

1. **Problem:** Tools are scattered; decisions are slow.  
2. **Solution:** Cortex — whole business, one AI conversation.  
3. **Why now:** Speed and AI advantage decide who wins.  
4. Dashboard briefs you.  
5. Assistant answers across modules.  
6. Knowledge Base is the memory agents search.  
7. Multi-agents specialize; Executive coordinates.  
8. Workflows ship as working templates.  
9. Reorder turns risk into a PO.  
10. CRM / sales / finance / HR / predictions sit underneath.  
11. Owner invites the team by email + role.  
12. Close on ask → act → plan.

---

## Demo-able features & routes


| Feature                    | Why it demos well                                      | Route                                                                       |
| -------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Landing                    | Brand, hero, features, pricing CTA                     | `/`                                                                         |
| Login / Register           | Auth entry; demo credentials                           | `/login`, `/register`                                                       |
| Workspace setup            | Onboarding (new tenants)                               | `/setup`                                                                    |
| Master dashboard           | KPIs + AI daily briefing                               | `/dashboard`                                                                |
| AI Executive Assistant     | Natural-language Q&A / actions                         | `/assistant`                                                                |
| Knowledge Base             | Customers, products, suppliers, docs → AI memory       | `/knowledge`                                                                |
| Multi-Agent Control        | Finance / Sales / Inventory / Ops / Executive          | `/agents`                                                                   |
| Agent detail               | Thought stream, invoke task                            | `/agents/finance`, `/agents/sales`, `/agents/inventory`, `/agents/operations`, `/agents/executive` |
| Workflows                  | Visual automation + pre-built templates                | `/workflows`                                                                |
| Inventory                  | Ops dashboard                                          | `/inventory`                                                                |
| Reorder Centre             | Low-stock → supplier groups → draft POs                | `/inventory/reorder`                                                        |
| Products / POs / Suppliers | Deeper ops (optional)                                  | `/inventory/products`, `/inventory/purchase-orders`, `/inventory/suppliers` |
| CRM                        | Pipeline, contacts, analytics                          | `/crm`, `/crm/pipeline`, `/crm/contacts`                                    |
| Sales                      | Quotes → orders                                        | `/sales/quotes`, `/sales/orders`                                            |
| Finance                    | Invoices, AR/AP, reports                               | `/finance`                                                                  |
| Predictions                | Forecast, stock risk, churn, supplier risk             | `/predictions`                                                              |
| Analytics                  | Executive scorecards                                   | `/analytics`                                                                |
| HR                         | Employees, leave, payroll                              | `/hr`                                                                       |
| Team invite                | Owner invites members by email + role                  | `/settings/team` → invite → `/invite/[token]`                               |
| Settings                   | Roles, billing, branding                               | `/settings`                                                                 |


**Marketing anchors:** `#features`, `#pricing`, `#social`  
**Power-user:** ⌘K command palette from the top bar  

---

## Pre-built workflow templates (demo shortlist)

Show **one**. Mention others only by name.


| Template            | Trigger idea                         | Punchline on camera                                      |
| ------------------- | ------------------------------------ | -------------------------------------------------------- |
| Procure to Pay      | Stock below reorder                  | Auto PO decision or manager alert                        |
| Order to Cash       | Order delivered                      | Sale → invoice → reminders → escalate                    |
| Lead to Deal        | New lead contact                     | Nurture → tasks → offer → re-engage                      |
| Month-End Close     | Schedule (1st of month)              | P&L, AR, reorder report, executive digest                |
| Employee Onboarding | New hire                             | Account → leave → welcome → checklist                    |


---

## On-camera rules

- Story spine: **brief → ask → know → specialize → automate → act → forecast → invite**
- Heroes get airtime: Assistant, Knowledge, Agents, Workflows — everything else is a normal pass  
- Don’t open Admin (`/admin/*`), empty modules, or long settings forms  
- If briefing is slow, talk over KPIs, then cut to Assistant  
- Prefer one strong assistant answer over three weak ones  
- On Agents: explain orchestration; don’t tool-tour  
- On Workflows: open a **template**, never build live  
- End on Predictions/Assistant/Agents — don’t wander back to Landing  
- Use the brand name **Cortex** on camera (package/code may still say SAIOS)

---

## Demo gotchas


| Gotcha           | Detail                                                                             |
| ---------------- | ---------------------------------------------------------------------------------- |
| Auth required    | Most app routes redirect to `/login`. Public: `/`, auth pages, `/legal/`*.         |
| Empty workspace  | Charts/KPIs/knowledge can be empty — load demo data before recording.              |
| AI / workers     | Briefing, assistant, agents need LLM keys. Some features may need Redis/BullMQ.    |
| MFA              | If enabled, flow goes through `/mfa/verify` — disable for demos.                   |
| Briefing latency | Dashboard briefing may show “Preparing…” — wait or refresh before talking over it. |
| Knowledge empty  | Upload or seed at least one document so “AI memory” lands visually.                |
| Agents idle      | If thought stream is quiet, narrate the five roles + orchestration from the cards. |
| Workflows        | Use a template graph; blank canvas looks unfinished on camera.                     |
| Invite demo      | Prefer showing the invite modal without sending, unless using a throwaway email.   |
| Admin vs tenant  | `/admin/*` is platform admin — not the customer journey.                           |


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
> This is Cortex — an enterprise AI operating system. The idea is simple: your entire business, one AI conversation. Inventory, sales, finance, knowledge, agents, workflows — not five tools, one workspace you can talk to.
>
> I’ll jump into a live workspace.
>
> After login, you don’t just get charts. Cortex briefs you — what’s moving, what’s at risk, what to do next. That briefing is the daily command center.
>
> This is the AI Executive Assistant — the front door. I’m not searching modules — I’m asking the business. It pulls across inventory, CRM, finance, and the knowledge base, and turns it into something an executive can act on.
>
> Agents and the assistant are only as good as what they know. The Knowledge Base is that memory — customers, products, suppliers, policies, SOPs, contracts. Embedded for semantic search, so answers come from your real business knowledge.
>
> Cortex doesn’t use one generic chatbot. It runs specialized agents: Finance, Sales, Inventory, Operations, and Executive. The orchestrator routes the task. Cross-functional asks go to the Executive Agent, which can delegate to specialists and synthesize one view. Five specialists. One coordinated answer.
>
> Workflows are the automation layer — and they ship with working templates. Here’s Procure to Pay: stock drops below reorder, decide auto-PO or alert a manager. Trigger, conditions, actions — already wired. Same idea for order-to-cash, lead-to-deal, month-end close.
>
> Operations side — when stock is the risk, Reorder Centre groups low-stock items by supplier and drafts the purchase order.
>
> Same workspace for CRM, sales, and finance — pipeline, quotes, orders, invoices, AR and AP. Predictions look ahead on demand, stock risk, and churn. HR covers people, leave, and payroll.
>
> And to grow the company on Cortex: the owner invites team members by email, assigns a role, they set a password, and they land in the workspace with the right permissions.
>
> That’s Cortex — knowledge that feeds the AI, agents that coordinate, an assistant you can talk to, workflows that already work, and the full business underneath. Not another dashboard — one place to ask, act, and plan. In this era, the business that can think together, wins.
>
> Try the workspace — start with the assistant, open the agents, and run the business from one conversation.

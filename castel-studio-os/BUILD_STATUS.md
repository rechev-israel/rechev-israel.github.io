# CASTEL STUDIO — AI Business OS · Build Status

_Last updated: 2026-11-16 · Phase 1 (foundation + first operational modules)_

The platform is **not complete**. This file is the single source of truth for what works today.

Legend: ✅ implemented & tested · 🟡 partial · 🔑 implemented, needs API credentials to activate · 📋 planned (schema/architecture only)

## Phase 1 — Foundation

| Area | Status | Notes |
|---|---|---|
| Next.js 15 App Router + TypeScript + Tailwind v4 | ✅ | Production build passes |
| PostgreSQL + Prisma schema & migration | ✅ | 30+ models covering all modules, multi-branch ready (`Business` → `Branch`) |
| Authentication | ✅ | bcrypt (cost 12), DB-backed sessions (SHA-256 token hash, HttpOnly/SameSite cookie), lockout after 5 failed logins (15 min), password change revokes other sessions |
| Role-based access control | ✅ | 7 roles, permission map enforced **server-side** in every action, page and API route |
| Audit log | ✅ | Logins, CRUD, exports, consent changes, approvals, certificates |
| Hebrew RTL / English LTR | ✅ | Cookie-based locale; `dir` switches on `<html>`; logical CSS properties throughout |
| Dark / light theme | ✅ | Black/charcoal/gold design tokens; dark default |
| Responsive shell | ✅ | Sidebar (drawer on mobile), verified at 390 px with no horizontal scroll |
| Security headers, CSRF | ✅ | X-Frame-Options, nosniff, Referrer-Policy; Server Actions origin check + Origin check on cookie-auth API mutations |
| Structured logging | ✅ | JSON logs (`src/lib/logger.ts`) |
| Tests | ✅ | 33 Vitest tests: domain logic, RBAC, AI routing, CSV adapter, validation + PostgreSQL integration tests (capacity under concurrency, tenant isolation, payments → transactions, certificates, double-booking) |
| Background jobs | 🟡 | `npm run jobs` (session purge, segment recompute) for cron. Durable queue in Phase 3 |

## Modules

| Module | Status | What works | What's missing |
|---|---|---|---|
| **A. Executive Command Center** | ✅ | Daily/monthly revenue, expenses, net & margin (actuals only), appointments today/week, customers, students, leads, 6-month trend chart, alerts (at-risk, birthdays, unpaid students, new leads, approvals, no-shows), upcoming appointments, open tasks, rule-based insights | LLM-written insights (agents page covers this with a key); marketing metrics need Ads APIs |
| **B. Smart CRM** | ✅ | Customer CRUD, search/filter/sort/pagination, profiles, notes (pinned), appointment history, interaction log, preferences, tags, automatic segmentation (Active / At-risk 45d / Lapsed 90d / VIP), per-channel consent with timestamp, birthday campaign → approval queue, follow-up tasks, CSV export, archive | Automated follow-up sequences (Phase 3) |
| **C. Booking Management** | ✅ | Week calendar, create appointment, status workflow (confirm / complete / no-show / cancel / revert), staff double-booking detection, services & pricing CRUD, opening hours (seeded placeholder), 30-day analytics (cancellation, no-show, avg ticket); completing an appointment posts ACTUAL income once (reverting removes it) | Availability editor UI; external app sync |
| ↳ External booking app adapter | 🟡 | **CSV import only** (no public API assumed for cali-b5f0e.web.app): Israeli date formats, dedupe, customer matching by phone, income for completed rows | Direct API/webhook only if the vendor provides one |
| **D. CASTEL STUDIO ACADEMY** | ✅ | Group (6×2h = 12h, 5,500 ₪, max 5) and VIP (5×2h + 3h = 13h, 6,500 ₪) courses; cohort creation with auto-generated 2-per-week lesson schedule (DST-safe, Jerusalem time); lesson topics; student registration & profiles; enrollment with **capacity enforced in a serializable transaction**; attendance grid; payments (each creates an ACTUAL income transaction); progress; certificate eligibility (paid in full + ≥5/6 attendance), sequential numbers `CSA-YYYY-NNNN`, printable certificate; course materials; lead pipeline (kanban) with convert-to-student; **public landing page `/join`** with consent, honeypot and rate limit | Online payment collection; e-mailing certificates |
| **E. AI Marketing Department** | 🔑/📋 | Marketing & Content agents work on the AI Agents page once `ANTHROPIC_API_KEY` is set; `Campaign` model | Saved campaign plans, content calendar UI, budget planner, performance reporting |
| **F. AI Creative Studio** | 📋 | Provider env vars + integration status | Image/video/voice provider adapters — will only be marked functional when a real provider is configured |
| **G. Website & Landing Page Builder** | 🟡 | Academy landing page live at `/join` | Block editor, SEO settings, publish workflow, custom domains |
| **H. AI Agents Department** | 🔑 | 8 specialists + deterministic orchestrator (keyword routing, testable, works without a key); permission-scoped **aggregated** business context (no names/phones sent); finance data only for Owner/Accountant; agents can only *request* external actions via a `request_approval` tool → Approvals center; conversation history persisted; Anthropic SDK with server-side refusal fallback | Needs `ANTHROPIC_API_KEY`. Without it, routing is shown and the UI states that no model was called |
| **Approvals center** | ✅ | Queue for message.send / content.publish / ads.spend / data.delete; Owner-only decisions with notes; audit trail | Executors (Phase 3): approved items are **not** executed automatically and are marked for manual handling |
| **I. Personal AI Digital Twin** | 📋 | `KnowledgeItem` model | Requires explicit consent, owner source media and a configured avatar/voice provider — no cloning without them |
| **J. Finance & BI** | ✅ | Transactions CRUD with ACTUAL vs ESTIMATE separation, monthly report, 12-month cash-flow chart, category breakdowns, naive forecast (labelled estimate, needs ≥2 months), price/volume scenario planner, CSV export (formula-injection safe), printable report (browser "Save as PDF"), disclaimer that reports are not tax documents | Server-generated PDF; VAT handling |
| **K. Automation Builder** | 📋 | `Automation`/`AutomationRun` models; built-in coded flows (appointment → income + stats, payment → transaction, lead → pipeline) | Visual builder, engine, retries, approval steps |
| **L. Communications Center** | 🟡 | Interaction history, consent/opt-out per channel, message drafts via approval queue, `MessageTemplate` model | Inbox, templates UI, sending (needs WhatsApp Cloud API / SMTP) |
| **M. Analytics** | 🟡 | Revenue trend, retention %, lead conversion, no-show/cancellation 30/90d, segments, leads vs enrollments by month, lead sources | AI-assisted analysis, campaign conversions |
| **Integration status page** | ✅ | Live status for every provider: Connected / Not configured / Requires authorization / Error; persisted last-check | — |
| Tasks | ✅ | Create, assign, priority, due date, complete/reopen; CRM follow-ups | — |
| Settings | ✅ | Business profile, change password, user management (Owner): create users, change roles, deactivate (sessions revoked), last-owner protection | — |

## Requires API credentials

| Capability | Env var(s) |
|---|---|
| AI agents / insights | `ANTHROPIC_API_KEY` (optional `ANTHROPIC_MODEL`, default `claude-opus-5-5`) |
| WhatsApp sending | `WHATSAPP_CLOUD_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |
| Email sending | `SMTP_URL` |
| Instagram / Meta Ads | `META_ADS_ACCESS_TOKEN` + Meta app review |
| Google Ads | `GOOGLE_ADS_DEVELOPER_TOKEN` + OAuth |
| Image / video / voice | `IMAGE_PROVIDER_API_KEY`, `VIDEO_PROVIDER_API_KEY`, `TTS_PROVIDER_API_KEY` (adapters in Phase 4) |

## Roadmap

- **Phase 2** — availability editor, customer self-service booking link, staff schedules, academy payment reminders (draft → approval), Hebrew PDF generation server-side, e2e test suite in CI.
- **Phase 3** — Automation engine (queue, retries, run history, approval steps), Communications (WhatsApp/SMTP executors for approved items, templates, inbox), Marketing department (campaign planner, content calendar), page builder.
- **Phase 4** — Creative Studio provider adapters, Meta/Google Ads read-only reporting then approval-gated spend, Instagram publishing via approvals.
- **Phase 5** — Digital Twin (consent flow, approved knowledge base, avatar/voice providers), multi-branch UI, encrypted secret store.

## Known limitations

- Rate limiting is in-memory (single instance). Use Redis or the hosting provider's limiter when scaling out.
- Seeded opening hours are placeholders — confirm real hours.
- No services/prices are seeded (real prices unknown); add them in Bookings → Services. `SEED_DEMO_DATA=true` creates records clearly tagged `[DEMO]`, removable with `npm run db:purge-demo`.

# CASTEL STUDIO AI Business OS — Feature Status

_Last updated: 2026-11-18 · Package 2 complete · **Deployments frozen** (owner decision — `vercel.json` `git.deploymentEnabled: false`); live site still runs the Phase 2 batch 1 build_

Legend: ✅ working & tested · 🟡 partial · 🔑 built, needs credentials to activate · 📋 planned

| # | Module | Status | What works now | Still missing |
|---|---|---|---|---|
| 1 | **Executive dashboard** | ✅ | Live KPIs from DB (revenue/expenses/net/margin — actuals only), appointments, customers, students, leads, 6-month trend, alerts (approvals, pending messages, failed automations, at-risk, birthdays, unpaid, leads, no-shows), notifications widget, academy widget, marketing widget, rule-based insights, **AI insights on demand** 🔑, **per-user customisable widgets** | Drag-and-drop ordering |
| 2 | **CRM** | ✅ | Profiles, history, notes, preferences, interactions, segments, consent per channel, birthdays, search/filter/sort/pagination, CSV export, automated follow-ups, **unified customer timeline** (appointments incl. Cali, messages, payments, interactions, notes), **loyalty tiers** (New/Silver/Gold/Platinum) + next milestone + milestone automation, **general lead pipeline** (barbershop & academy, manual entry, follow-up dates/overdue, lost reason, convert to customer/student) | — |
| 3 | **AI Agent Command Center** | 🔑 | 8 agents (CEO, Marketing, Sales, Finance, Support, Academy, Creative, Automation), auto-routing + manual selection, conversation history, permission-scoped aggregated data, tools: `request_approval`, `create_task`, `create_content_idea`, error logging, token usage & estimated cost tracking, **monthly budget cap** (`AI_MONTHLY_BUDGET_USD`) | Needs `ANTHROPIC_API_KEY`. Streaming replies |
| 4 | **Automation engine** | ✅ | Event triggers (customer, appointment created/completed/no-show, lead, enrollment, campaign), scheduled triggers (daily reminders, birthdays, lead follow-ups, weekly report), conditions (10 operators), multi-step actions, activate/deactivate, run log with per-step detail, retries with exponential backoff, dedupe, approval steps, **visual builder**, 9 built-in workflows | Daily cron needs `CRON_SECRET` 🔑 (manual "Run now" works without it). Hobby plan = 1 cron/day |
| 5 | **Marketing control center** | ✅ / 🔑 | Campaigns (create, submit → owner approval → live → ended), manual results (spend, impressions, clicks, leads, conversions — labelled manual), content calendar (month grid, Instagram/TikTok/Facebook, status flow, manual performance), real lead funnel (90d), customer sources, AI caption / hashtag / ad copy / monthly calendar / strategy generators 🔑 | Meta Ads, Instagram, TikTok, Google Ads APIs (architecture + status only — **not connected**) |
| 6 | **Financial management** | ✅ | Transactions (actual vs estimate), categories, 12-month cash flow, monthly report, **12-month P&L matrix** (by category, totals, net, margin %) + **P&L CSV**, academy revenue, forecast, scenarios, CSV + printable/PDF, ILS & Israeli dates | Server-generated PDF, VAT |
| 7 | **Academy** | ✅ | Group (6×2h=12h, 5,500 ₪, max 5) & VIP (5×2h+3h=13h, 6,500 ₪), cohorts, schedule, enrollment w/ capacity lock, attendance, payments, progress, certificates, materials, lead pipeline, `/join`, **student portal** (private hashed link: schedule, attendance, progress, balance, materials, printable certificate), **weekly payment-reminder automation** (service message to student, owner approval), **academy analytics** (attendance rate, lead conversion, revenue per course) | — |
| 8 | **Communication center** | ✅ / 🔑 | Unified queue: drafts → owner approval → real provider send → status (sent/failed/blocked/cancelled), bulk approve/cancel, compose, WhatsApp & Email templates (he/en, editable), consent enforcement (marketing requires opt-in; opt-out & blocked respected), communication history on send | **WhatsApp sending disabled by kill switch** (`WHATSAPP_SENDING_ENABLED`, account restriction); SMTP (`SMTP_URL`, `SMTP_FROM`) 🔑; student recipients supported |
| 9 | **Responsive premium UI** | ✅ | Sidebar / tablet rail / phone tab bar, he RTL + en LTR, dark/light, PWA, verified at 390/768/1024/1440 | — |
| 10 | **Security & reliability** | ✅ | bcrypt + hashed DB sessions, lockout, RBAC on every action/page/API (new: automations, comms approve, marketing), Zod validation, CSRF/origin checks, audit log, secrets only in env, additive-only migrations applied at build, structured logs, error records for AI/automation, 47 automated tests | External error monitoring service (e.g. Sentry) |
| — | **Cali booking sync** | ✅ / 🔑 | Signed HMAC webhook endpoint (idempotent upserts, cancellations, customer matching by id/phone, revenue once per completed appointment, sync log, replay protection), duplicate-free CSV import (Hebrew/English headers), sync history UI, integration status | Cali has no public API — needs the vendor to push events + `CALI_WEBHOOK_SECRET`; availability not exposed by Cali. See CALI_INTEGRATION.md |
| — | Creative Studio (image/video/voice) | 📋 | Creative agent writes prompts/concepts 🔑 | Media provider adapters |
| — | Digital Twin | 📋 | — | Consent flow, approved knowledge base, avatar/voice provider |
| — | Website builder | 🟡 | Academy landing page `/join` | Block editor, SEO, custom domains |

## Environment variables (Vercel → Settings → Environment Variables)

| Variable | Needed for | Status |
|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Database | ✅ set by Neon |
| `SETUP_TOKEN` | First-run owner creation | ✅ set (can be removed after setup) |
| `CRON_SECRET` | Daily automations (reminders, birthdays, follow-ups, weekly report, retries, scheduled sends) | ❌ **add** — any long random string |
| `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`) | AI agents, insights, marketing generators | ❌ add when ready |
| `WHATSAPP_SENDING_ENABLED` + `WHATSAPP_CLOUD_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Sending approved WhatsApp messages | ⛔ intentionally OFF until the account restriction is resolved |
| `AI_MONTHLY_BUDGET_USD` | Optional AI spend cap | optional |
| `SMTP_URL`, `SMTP_FROM` | Sending approved emails | ❌ any SMTP provider |
| `CALI_WEBHOOK_SECRET` | Live sync from Cali | ❌ set together with the Cali developer (see CALI_INTEGRATION.md) |
| `META_ADS_ACCESS_TOKEN`, `GOOGLE_ADS_DEVELOPER_TOKEN` | Future ads reporting | 📋 adapters not built yet |

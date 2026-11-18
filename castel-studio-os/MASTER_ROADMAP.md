# CASTEL STUDIO AI Business OS — Master Roadmap

## Done
- **Phase 1** — foundation: auth/RBAC/audit, CRM, bookings (+CSV import), academy, finance, approvals, integrations status, AI orchestrator, responsive UI, PWA, Vercel + Neon deployment.
- **Phase 2 · batch 1** — automation engine (+9 built-in workflows, builder, cron, retries), communication center (approval queue, WhatsApp/SMTP adapters, templates, consent), marketing control center (campaigns, content calendar, funnel, AI generators), AI command center (8 agents, tools, usage/cost), customisable dashboard, notifications.

- **Package 2** — CRM lead pipeline + unified timeline + loyalty tiers/milestones, academy student portal + payment reminders + analytics, 12-month P&L (+CSV), AI monthly budget cap, WhatsApp kill switch, Cali signed sync endpoint + duplicate-free import, deployment freeze.

## Deployment policy
Deployments are **live** (owner approved 2026-11-19): every push to the production branch deploys; migrations are additive and apply automatically at build. `SECRETS_ENCRYPTION_KEY` and `CRON_SECRET` are set in Vercel.

- **Package 3** — AI Creative Studio: built-in brand graphic designer, OpenAI/Replicate/ElevenLabs adapters (pending configuration), async jobs + cron polling, output persistence, asset library with approval, brand kit, AI prompt writer.

- **Package 4** — Website builder (blocks, live data, approved images, SEO, draft/preview/owner publish, public `/s/<slug>`, lead capture) and Digital Twin (explicit consent with scopes & revoke, approved knowledge, grounded chat, scripts, consent-gated owner voice & avatar video).

- **Integration Center** — "מרכז חיבורים": real per-provider connection tests (Anthropic first), Connected only after verification of current credentials, encrypted in-app credential storage (AES-256-GCM), Meta OAuth, cron-run recording, redaction of secrets from errors/logs.

- **Online booking** — own booking system replacing the external app: public `/book`, slot engine, race-safe booking, manage link, owner settings, site block. (Cali sync/import kept for the transition.)

- **Booking upgrade** — customer month calendar, admin day/3-day/week scheduler with full appointment management, deduplicated owner notifications with live bell and deep links, Web Push, double-booking fix (completed/no-show keep the slot).

- **Premium redesign** — brand tokens aligned with the website, refined base components, wrapping page actions, calendar polish + summary strip; 50-screen responsive audit clean.

## Next — Package 5: Hardening & go-live readiness
1. External error monitoring (e.g. Sentry) + uptime alert on `/api/health`.
2. Blob storage adapter (Vercel Blob / S3) for large video/3D assets instead of temporary provider links.
3. Streaming AI replies; per-agent tool permissions UI.
4. Staff-facing mobile polish pass on every new screen; accessibility audit (keyboard, contrast, screen readers).
5. Go-live checklist: set `CRON_SECRET`, `SECRETS_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY` (test it in מרכז חיבורים), remove deploy freeze, custom domain, publish the home page, verify Cali sync status.

## Phase 3
- Ads integrations: Meta Marketing API & Google Ads (read-only reporting first, then approval-gated spend), Instagram Graph publishing via approvals, TikTok content API.
- Website/landing builder (blocks, SEO, preview/publish, custom domain).
- Creative Studio provider adapters (image/video/TTS) — marked active only when a provider is configured.
- Error monitoring service, uptime alerts, nightly DB backup verification.

## Phase 4
- Digital Twin (explicit consent, owner-approved knowledge base, avatar/voice providers, approval before publishing).
- Multi-branch & staff scheduling UI, payroll inputs, inventory.

## Continuation prompt
> Continue CASTEL STUDIO AI BUSINESS OS from FEATURE_STATUS.md and MASTER_ROADMAP.md on branch `claude/castel-studio-ai-os-976xw1`. Deployments stay frozen. Implement the next incomplete package in order, with additive migrations only, tests, TypeScript check, production build, and a push (no deploy). Update both documents when done.

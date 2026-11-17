# CASTEL STUDIO AI Business OS — Master Roadmap

## Done
- **Phase 1** — foundation: auth/RBAC/audit, CRM, bookings (+CSV import), academy, finance, approvals, integrations status, AI orchestrator, responsive UI, PWA, Vercel + Neon deployment.
- **Phase 2 · batch 1** — automation engine (+9 built-in workflows, builder, cron, retries), communication center (approval queue, WhatsApp/SMTP adapters, templates, consent), marketing control center (campaigns, content calendar, funnel, AI generators), AI command center (8 agents, tools, usage/cost), customisable dashboard, notifications.

- **Package 2** — CRM lead pipeline + unified timeline + loyalty tiers/milestones, academy student portal + payment reminders + analytics, 12-month P&L (+CSV), AI monthly budget cap, WhatsApp kill switch, Cali signed sync endpoint + duplicate-free import, deployment freeze.

## Deployment policy
Deployments are **frozen** until the owner approves going live (`vercel.json` → `git.deploymentEnabled: false`). To go live: set it to `true` (or remove the `git` block) and push; migrations are additive and apply automatically.

- **Package 3** — AI Creative Studio: built-in brand graphic designer, OpenAI/Replicate/ElevenLabs adapters (pending configuration), async jobs + cron polling, output persistence, asset library with approval, brand kit, AI prompt writer.

- **Package 4** — Website builder (blocks, live data, approved images, SEO, draft/preview/owner publish, public `/s/<slug>`, lead capture) and Digital Twin (explicit consent with scopes & revoke, approved knowledge, grounded chat, scripts, consent-gated owner voice & avatar video).

## Next — Package 5: Hardening & go-live readiness
1. External error monitoring (e.g. Sentry) + uptime alert on `/api/health`.
2. Blob storage adapter (Vercel Blob / S3) for large video/3D assets instead of temporary provider links.
3. Streaming AI replies; per-agent tool permissions UI.
4. Staff-facing mobile polish pass on every new screen; accessibility audit (keyboard, contrast, screen readers).
5. Go-live checklist: set `CRON_SECRET`, `ANTHROPIC_API_KEY`, remove deploy freeze, custom domain, publish the home page, verify Cali sync status.

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

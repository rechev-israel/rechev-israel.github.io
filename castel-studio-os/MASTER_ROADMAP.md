# CASTEL STUDIO AI Business OS — Master Roadmap

## Done
- **Phase 1** — foundation: auth/RBAC/audit, CRM, bookings (+CSV import), academy, finance, approvals, integrations status, AI orchestrator, responsive UI, PWA, Vercel + Neon deployment.
- **Phase 2 · batch 1** — automation engine (+9 built-in workflows, builder, cron, retries), communication center (approval queue, WhatsApp/SMTP adapters, templates, consent), marketing control center (campaigns, content calendar, funnel, AI generators), AI command center (8 agents, tools, usage/cost), customisable dashboard, notifications.

## Next — Phase 2 · batch 2
1. **Bookings**: availability editor (opening hours, barbers, breaks), customer self-booking link with slot picking, reschedule/cancel links.
2. **CRM**: general lead pipeline (barbershop leads), loyalty tiers & visit milestones, customer timeline merging appointments/messages/payments.
3. **Communications**: WhatsApp delivery-status webhook (`/api/webhooks/whatsapp`), Meta-approved template mapping, inbound inbox, SMS adapter.
4. **AI**: streaming responses, per-agent tool permissions UI, monthly AI budget limit with alerts.
5. **Academy**: student portal (progress, schedule, materials, certificate download), payment reminders via automation.

## Phase 3
- Ads integrations: Meta Marketing API & Google Ads (read-only reporting first, then approval-gated spend), Instagram Graph publishing via approvals, TikTok content API.
- Website/landing builder (blocks, SEO, preview/publish, custom domain).
- Creative Studio provider adapters (image/video/TTS) — marked active only when a provider is configured.
- Error monitoring service, uptime alerts, nightly DB backup verification.

## Phase 4
- Digital Twin (explicit consent, owner-approved knowledge base, avatar/voice providers, approval before publishing).
- Multi-branch & staff scheduling UI, payroll inputs, inventory.

## Continuation prompt
> Continue CASTEL STUDIO AI BUSINESS OS from FEATURE_STATUS.md and MASTER_ROADMAP.md on branch `claude/castel-studio-ai-os-976xw1`. Implement **Phase 2 · batch 2** items 1–5 in order, with additive migrations only, tests, a production build, and a push (auto-deploys to Vercel). Update both documents when done.

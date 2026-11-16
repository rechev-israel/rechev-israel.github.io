# CASTEL STUDIO — AI Business OS

Business operating system for **CASTEL STUDIO**, a premium men's barbershop and barber academy in Ashkelon, Israel.
Hebrew-first (RTL) with English (LTR), ILS currency, Asia/Jerusalem timezone.

See **[BUILD_STATUS.md](./BUILD_STATUS.md)** for exactly what is implemented, partial, credential-gated and planned.

## Quick start (local)

Requirements: Node.js 20+ (tested on 22), PostgreSQL 14+ (tested on 16).

```bash
cd castel-studio-os
npm install

# 1. Configure
cp .env.example .env
#   - set DATABASE_URL to your Postgres
#   - set AUTH_SECRET:  openssl rand -hex 32
#   - set SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD (min 10 chars, letters+digits)
#     (leave the password empty to have one generated and printed once)

# 2. Database
createdb castel_os            # or create it in your Postgres UI
npx prisma migrate deploy     # apply schema
npm run db:seed               # business, owner user, Group + VIP academy courses

# Optional: clearly-labelled demo records to explore the UI
SEED_DEMO_DATA=true npm run db:seed
npm run db:purge-demo         # removes every [DEMO] record

# 3. Run
npm run dev                   # http://localhost:3000  (log in with the seeded owner)
```

Production:

```bash
npm run build && npm start    # set NODE_ENV=production; serve behind HTTPS (session cookie is Secure)
npm run jobs                  # schedule nightly (cron): purges expired sessions, recomputes CRM segments
```

Public academy landing page (no login): `http://localhost:3000/join`.
Health check: `GET /api/health`.

### Tests

```bash
npm test                                  # unit tests (domain, RBAC, router, CSV, validation)
TEST_DATABASE_URL=postgresql://…/castel_os_test npm run test:db   # + PostgreSQL integration tests (DB is truncated!)
npm run typecheck
```

### Enable AI agents

Add `ANTHROPIC_API_KEY` to `.env` (optional `ANTHROPIC_MODEL`, default `claude-opus-5-5`) and restart.
Without a key the orchestrator still routes requests and the UI clearly states no model was called.

## Architecture

```
castel-studio-os/
├─ prisma/
│  ├─ schema.prisma        # all modules' data model (multi-branch ready)
│  ├─ migrations/
│  └─ seed.ts              # business, owner, academy courses; optional [DEMO] data
├─ src/
│  ├─ app/
│  │  ├─ (app)/…           # authenticated pages (dashboard, crm, bookings, academy, finance, agents, approvals, …)
│  │  ├─ login/            # sign-in
│  │  ├─ join/             # public academy landing page + lead form
│  │  └─ api/              # route handlers: ai/chat, crm/export, finance/export, public/leads, health
│  ├─ domain/              # pure business rules (academy schedule/eligibility, CRM segments/consent, finance) — unit tested
│  ├─ server/
│  │  ├─ auth/             # password hashing, DB sessions, RBAC permission map, page guard
│  │  ├─ services/         # business-scoped data operations (crm, bookings, academy, metrics)
│  │  ├─ actions/          # Server Actions (validate → authorize → service → audit → revalidate)
│  │  ├─ ai/               # agents, deterministic router, provider adapter (Anthropic), orchestrator
│  │  ├─ integrations/     # integration registry/status, external booking CSV adapter
│  │  └─ audit.ts
│  ├─ i18n/                # he.ts (source of truth) / en.ts, cookie-based locale
│  ├─ components/          # UI kit (shadcn-style), shell, charts, forms
│  └─ lib/                 # db client, Jerusalem-time date helpers, validation (Zod), logger, rate limit
├─ scripts/                # run-jobs.ts, purge-demo.ts
└─ tests/
```

**Request flow.** Pages are React Server Components that call `pageGuard(permission)`; mutations are Server Actions that
parse input with Zod, call `requireUser(permission)`, run a business-scoped service (every query filters by
`businessId` — tenant isolation is integration-tested), write an audit entry and revalidate.

**Money.** Every real ILS amount is a `Transaction` with `kind = ACTUAL | ESTIMATE`. Completed appointments and academy
payments post ACTUAL income automatically (idempotent). Dashboards and charts show actuals only; forecasts are labelled
estimates and require history.

**External actions are never automatic.** Messages, publishing, ad spend and deletions are created as
`ApprovalRequest`s; only the Owner can approve. In Phase 1 there are no executors, so approved items are not sent.

**Integrations.** Secrets come only from environment variables; `/integrations` reports Connected / Not configured /
Requires authorization / Error. The existing booking app (cali-b5f0e.web.app) has no assumed API — CSV import only.

**Security.** bcrypt, hashed DB sessions, lockout, RBAC on the server, CSRF origin checks, security headers,
CSV formula-injection escaping, public endpoint rate limit + honeypot + explicit consent, audit log,
AI context limited to aggregated non-identifying data.

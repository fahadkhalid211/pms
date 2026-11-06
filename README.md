# Lumina PMS

[![Build & Test Status](https://img.shields.io/badge/build-passing-brightgreen)](./PROGRESS.md)
[![Test Suites](https://img.shields.io/badge/vitest-90%20passed-brightgreen)](./tests)
[![E2E Journeys](https://img.shields.io/badge/playwright-3%20passed-brightgreen)](./e2e)
[![Next.js](https://img.shields.io/badge/next.js-15.5-black)](https://nextjs.org)
[![MySQL](https://img.shields.io/badge/mysql-8%20%2F%20mariadb-blue)](https://www.mysql.com)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**Lumina PMS** is a modern, AI-powered hospitality property management system designed for boutique hotels, resorts, guesthouses, serviced apartments, and vacation rental management companies.

It combines an operational hospitality core — properties, rooms, atomic room nights, seasonal rate plans, front desk check-in/out workspaces, housekeeping task assignments, maintenance work orders, and penny-precise invoicing — with an autonomous AI operations agent, human-in-the-loop supervisor approvals, anti-IDOR guest portal, MySQL FULLTEXT search knowledge base, and an integrations framework with RFC 5545 iCalendar feeds and idempotent webhook processing.

---

## Key Highlights

- **Anti-Double-Booking Engine:** Atomic `RoomNight` records guarded by database `@@unique([roomId, date])` unique constraints.
- **Strict Financial Precision:** All financial transactions, line items, taxes, fees, ADR, and RevPAR are computed using exact `Decimal(12, 2)` arithmetic. Zero floating-point money math.
- **Strict Multi-Tenant Scoping:** Every query, route handler, and service method is strictly scoped by `organizationId`. Verified across all 13 test suites.
- **AI Operations Hub with Human Approval:** Provider-agnostic adapter architecture supporting OpenAI, Google Gemini, Anthropic Claude, Groq, and Mock adapters. Sensitive actions (cancellations, refunds, bulk messaging) automatically pause execution for supervisory approval.
- **Public Guest Portal & Concierge Chatbot:** Hospitable-branded guest portal with live quotes, atomic bookings, online check-in, messaging, and strict anti-IDOR verification gates. Autonomous chatbot backed by MySQL FULLTEXT search (`MATCH ... AGAINST`).
- **Executive Analytics & RFC 4180 CSV Reports:** Real-time Occupancy %, ADR (`room revenue / rooms sold`), RevPAR (`room revenue / rooms available`), arrivals/departures queue, and streaming CSV downloads.
- **Integrations & iCal Engine:** AES-256-GCM credential encryption, RFC 5545 `.ics` subscription calendar export/import feeds, and HMAC SHA256 verified webhook receiver with idempotent deduplication by `externalId`.
- **Universal Activity Logging:** Captures both frontend user actions and backend operations with timestamps, user context, IP addresses, PII redaction, and human-readable summaries.
- **Standalone Docker Packaging:** Production-ready multi-stage `Dockerfile` utilizing Next.js `output: "standalone"` with non-root security execution.

---

## Tech Stack

| Domain | Technology |
| --- | --- |
| **Framework** | Next.js 15 (App Router), React 19, TypeScript |
| **Styling & Icons** | Tailwind CSS, Lucide Icons (HD thin-line, zero emojis) |
| **Database & ORM** | MySQL 8 or MariaDB 10.x, Prisma ORM |
| **Security & Auth** | JOSE JWT sessions, bcrypt password hashing, AES-256-GCM secret encryption, CSRF protection, OWASP security headers |
| **AI Integration** | Provider-agnostic adapter interface (OpenAI, Gemini, Groq, Anthropic, Mock) |
| **Job Queue** | ACID transactional database outbox with exponential backoff retries |
| **Unit & Integration Tests** | Vitest (13 suites, 90 automated tests) |
| **End-to-End Tests** | Playwright (3 automated multi-step journeys) |

---

## Quick Start

### 1. Prerequisites
- Node.js 20+ (LTS recommended)
- MySQL 8 or MariaDB 10.x database (or run the embedded local server with `npm run db:start`)
- npm 10+

### 2. Setup & Environment
```bash
# Clone repository
git clone <repository-url> pms
cd pms

# Install dependencies
npm ci

# Configure environment
cp .env.example .env
```

### 3. Database Initialization & Seeding
```bash
# Start the embedded local MySQL (separate terminal; first run downloads the server)
npm run db:start

# Apply schema migrations
npm run db:deploy

# Seed demo hotels, rooms, rate plans, and admin accounts
npm run db:seed
```

**Default Seed Credentials:**
- **Admin Email:** `admin@lumina.pms`
- **Password:** `Password123!`
- **Hotel:** *The Lumina Boutique*

### 4. Development Server
```bash
npm run dev
# Visit http://localhost:3000
```

---

## Verification & Testing

### Full Vitest Test Suite (13 Suites / 90 Tests)
```bash
npm test
```

### Playwright End-to-End Journeys
```bash
npm run test:e2e
```
*Journeys tested:*
1. **Admin Setup & Operations:** Login -> Executive Dashboard KPIs -> Global Omnisearch (Ctrl+K) -> Reservations -> Front Desk -> Invoices -> Reports.
2. **Customer Public Portal:** Room search -> Direct pricing quotes -> Anti-IDOR identity verification gate -> Online check-in.
3. **AI Operations & Governance:** AI Operations console -> Quick prompt chips -> Supervisor approval queue -> Knowledge Base management -> Provider credentials hub -> Activity logs.

### TypeScript Typecheck
```bash
npm run typecheck
```

### Production Build
```bash
npm run build
```

---

## Hostinger Deployment

See [docs/DEPLOY_HOSTINGER.md](docs/DEPLOY_HOSTINGER.md) for the step-by-step guide (Node.js web app + Hostinger MySQL).

---

## Docker Deployment

Lumina PMS includes a multi-stage Docker build producing a minimal standalone container:

```bash
# Build and run with Docker Compose
docker compose up -d

# Inspect running services
docker compose ps
```

The container runs as non-root user `nextjs` (UID 1001) on port `3000`.

---

## Project Documentation

- [`SUPERVISION_PLAN.md`](./SUPERVISION_PLAN.md) — Exhaustive 12-package supervisory protocol and verification gates.
- [`PROGRESS.md`](./PROGRESS.md) — Comprehensive execution log with raw test outputs for all 11 Work Packages.
- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) — Architecture, schema guarantees, and multi-tenant security specifications.
- [`docs/BACKUP_AND_RECOVERY.md`](./docs/BACKUP_AND_RECOVERY.md) — Enterprise disaster recovery runbook, RTO/RPO metrics, and WAL PITR guide.

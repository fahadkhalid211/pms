# Lumina PMS

**Lumina PMS** is an original, AI-powered hospitality property management system for hotels, guesthouses, resorts, serviced apartments, vacation rentals, and property management companies.

It combines the operational core of a modern PMS — properties, rooms, rates, reservations, front desk, housekeeping, billing — with an autonomous AI operations agent and a customer-facing AI support chatbot, all wrapped in a calm, learnable interface.

> **Note on brand:** Lumina PMS is an original product name and UI identity created for this project. No proprietary code, branding, or interface designs from existing products are used.

---

## Features

### Operations (admin / staff)
- Multi-property organizations with per-property scoping and configurable permissions.
- Property, room type, and room management with status lifecycle (`available`, `occupied`, `dirty`, `clean`, `inspected`, `out_of_service`).
- Rate plans, seasonal pricing, discounts, configurable fees, taxes.
- Reservation engine with live availability, conflict prevention, booking references, statuses, group bookings.
- Front desk workspace: arrivals/departures, quick check-in/check-out, walk-ins, occupancy, outstanding balances.
- Housekeeping task assignment and maintenance work orders with priorities and history.
- Invoices, line items, deposits, partial payments, refunds, printable invoices, financial summaries.
- Customer support conversations and notification delivery logs.

### Intelligence
- Admin AI provider hub: OpenAI, Google Gemini, Groq, Anthropic Claude — encrypted credentials, model checks, fallbacks, usage tracking.
- Autonomous operations agent with permission-aware tool registry, multi-step execution, approvals for sensitive actions, execution history, audit log.
- Customer chatbot: knowledge base (FAQs, policies, amenities, instructions), RAG-style retrieval, live PMS tools (availability, rates, verified booking lookup), human handoff.

### Customers
- Public booking search, availability, reservation creation, booking details, online check-in, payments, support messages, special requests, booking history, profile.

### Platform
- Global search, quick-create, calendar, reports, audit logs, data export, integrations framework, notification preferences.

---

## Tech Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| UI | Tailwind CSS, hand-rolled shadcn/ui-style design system components |
| Charts | Recharts |
| Backend | Next.js route handlers + server actions |
| Database | PostgreSQL (Prisma ORM) — SQLite for local development/tests |
| Auth | Auth.js-compatible credentials strategy (jose JWT sessions, bcrypt hashing) |
| Validation | Zod |
| AI | Provider adapter architecture (OpenAI, Gemini, Groq, Anthropic) |
| Background jobs | In-process durable-outbox runner (managed queue-ready) |
| Testing | Vitest (unit/integration), Playwright (E2E) |

---

## Getting Started

### Prerequisites

- Node.js 20+ (LTS recommended)
- npm 10+
- A PostgreSQL database (or use the included local SQLite fallback for development)
- An AI provider key (optional — core PMS functions work without AI)

### Installation

```bash
git clone <repository-url> pms
cd pms
cp .env.example .env
npm install
npx prisma migrate dev   # or: npm run db:push
npm run db:seed
npm run dev
```

### Environment variables

See [`.env.example`](./.env.example) for the full list. Key variables:

```
DATABASE_URL="postgresql://user:password@localhost:5432/lumina"
AUTH_SECRET="..."
AUTH_ENCRYPTION_KEY="..."        # 32-byte hex key for AI credential encryption
OPENAI_API_KEY="sk_..."          # optional
GEMINI_API_KEY="..."
GROQ_API_KEY="..."
ANTHROPIC_API_KEY="..."
```

### Scripts

```bash
npm run dev        # start dev server
npm run build      # production build
npm run start      # start production server
npm run db:push    # sync schema to database
npm run db:seed    # seed demo data
npm run test       # unit / integration tests
npm run test:e2e   # Playwright end-to-end tests
```

---

## Docker

```bash
docker compose up -d
```

See [`docker-compose.yml`](./docker-compose.yml).

---

## Testing

```bash
npm run test        # Vitest
npm run test:e2e    # Playwright
```

Critical paths covered: auth, RBAC, tenant isolation, availability, double-booking prevention, reservations, invoices, AI tool permissions, approvals.

---

## Deployment

- Vercel / Netlify / Docker container deployment documented in deployment guide.
- Environment variables provisioned via secrets manager.
- Database migrations applied as release steps.

---

## Project Status & Progress

See [`PROGRESS.md`](./PROGRESS.md).

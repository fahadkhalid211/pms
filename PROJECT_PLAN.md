# Lumina PMS — Project Plan

**Version:** 1.0 (MVP planning baseline)
**Status:** Planning / in progress

## 1. Executive Summary

Lumina PMS is an original, AI-powered hospitality property management platform for hotels, guesthouses, resorts, serviced apartments, vacation rentals, and property management companies. The product unifies property management, reservations, room availability, guest management, staff operations, billing, customer communication, analytics, an autonomous operations AI agent, and a customer-facing AI chatbot.

Unlike coarse enterprise PMS suites, Lumina is designed around a small, learnable operational core: a front desk that fits on one screen, reservations that cannot double-book, invoices that reconcile to the penny, and an AI layer that acts through authorized, auditable tools rather than talking to the database directly.

## 2. Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                        Browser (Responsive)                 │
│  Admin / Staff / Customer portals + Public booking + Chat   │
└───────────────────────────┬────────────────────────────────┘
                            │ HTTPS / JSON
┌───────────────────────────▼────────────────────────────────┐
│              Next.js 15 (App Router) API layer              │
│   Route Handlers · Server Actions · Zod validation          │
│   Server-side RBAC enforcement · Tenant scoping            │
└───────┬──────────────────┬────────────────────┬───────────┘
        │                  │                    │
        ▼                  ▼                    ▼
┌───────────────┐  ┌──────────────┐  ┌────────────────────┐
│  PostgreSQL   │  │   Redis/     │  │  AI Provider       │
│  (Prisma)     │  │   SQS-like   │  │  Adapters:         │
│  + FTS/RAG    │  │   queue*     │  │  OpenAI/Gemini/    │
│               │  │              │  │  Groq/Anthropic   │
└───────────────┘  └──────┬───────┘  └──────────┬─────────┘
                          │                     │
                          ▼                     ▼
                   Background job runner   AI tool executor
                   (notifications,        (permission-checked,
                    emails, reports)       approval-aware)
```

\* The MVP uses an in-process background job runner (durable outbox table + worker); swap to a managed queue without schema changes.

### Key architectural decisions

1. **Monolith-first**: Next.js App Router route handlers + server actions colocate API and UI. Extract services when load grows.
2. **Database**: PostgreSQL via Prisma ORM. Money stored as `Decimal` (Prisma `Decimal`), never `Float`. Reservation totals computed in DB transactions.
3. **Auth**: Auth.js-style credentials/JWT strategy implemented with `jose` + `bcryptjs`; httpOnly, secure session cookies; DB-backed session records where revocation is required.
4. **Validation**: `zod` schemas at every boundary; server is authoritative, client mirrors for ergonomics.
5. **AI**: Provider-agnostic adapter interface with per-provider request adapters; encrypted credential storage (AES-256-GCM); tool registry with permission checks; approval workflow for sensitive actions.
6. **RAG**: PostgreSQL full-text search (pgvector-ready schema) over knowledge base documents with ingestion status tracking.
7. **Background**: notification/email dispatch via background worker with retries and dead-letter handling.

## 3. Feature Map

### Implemented scope (MVP)

| Area | Status |
| --- | --- |
| Landing, auth (register/login/recover), org setup | In progress |
| RBAC: admin / staff / customer, permissions | In progress |
| Multi-property, room types, rooms, statuses | Planned |
| Availability + double-booking protection | Planned |
| Reservations CRUD, statuses, rates, invoices | Planned |
| Front desk, housekeeping, maintenance | Planned |
| Payments, refunds, invoicing | Planned |
| Dashboard analytics (ADR/RevPAR/occupancy) | Planned |
| AI provider hub + agent + approvals | Planned |
| Chatbot + knowledge base + RAG | Planned |
| Integrations framework | Planned |
| Reporting, audit logs, exports | Planned |
| Tests (Vitest + Playwright) | Planned |

### Planned (post-MVP) scope

- OTA channel integrations (Booking.com/Expedia/Airbnb) via approved APIs.
- Calendar sync (Google/Outlook), WhatsApp Business, accounting software.
- Vector search (pgvector), advanced RAG.
- Mobile app shell (responsive PWA).

## 4. Database Design (core entities)

- `User`, `Organization`, `OrganizationMembership`, `Role`, `Permission`, `UserPermissionOverride`
- `Property`, `PropertyMembership`, `RoomType`, `Room`, `Amenity`, `RoomAmenity`
- `RatePlan`, `SeasonalRate`, `AvailabilityOverride` (or derived from reservations)
- `Guest`, `GuestProfile`, `GuestRequest`
- `Reservation`, `ReservationRoom`, `ReservationGuest`
- `Invoice`, `InvoiceLineItem`, `Payment`, `Refund`, `Transaction`
- `HousekeepingTask`, `MaintenanceTicket`, `TaskComment`
- `Notification`, `SupportConversation`, `SupportMessage`, `ChatMessage`
- `KnowledgeBaseDocument`, `KnowledgeBaseChunk`, `AiProviderConfig`, `AiProviderCredential`
- `AiAgentExecution`, `AiToolExecution`, `ApprovalRequest`, `AgentAction`
- `Integration`, `IntegrationConnection`, `WebhookEvent`
- `AuditLog`, `SecurityEvent`

All queries carry `organizationId` scoping; cross-tenant access is prevented at the service layer.

## 5. Milestones

- **M1 — Foundations:** scaffold, DB schema, auth, org/tenant scoping, RBAC, audit.
- **M2 — Property graph:** properties, room types, rooms, rates, availability, reservations, guests.
- **M3 — Operations:** front desk, housekeeping, maintenance, invoices/payments.
- **M4 — Intelligence:** AI provider hub, agent tools, approvals, activity log.
- **M5 — Conversational AI:** chatbot widget, KB/RAG, handoff, live tools.
- **M6 — Insight & integration:** reports, integrations framework, hardening, tests.

## 6. Security & Compliance Notes

- Passwords hashed with bcrypt (cost ≥ 12); JWT sessions with rotation.
- Rate limiting on auth and AI endpoints; CSRF where cookies are used for auth.
- AES-256-GCM encrypted AI provider credentials; keys never logged or returned.
- Least-privilege permission checks in server services; AI tools re-check permissions.
- Audit logging on privileged mutations; data export/delete workflows.

## 7. Definition of Done (operational MVP)

See top-level `README.md` — functional checklist including end-to-end reservation flow, check-in/out, invoicing, AI agent with approvals, chatbot, tests.

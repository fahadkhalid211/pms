# Lumina PMS — Production Project Plan & Architectural Specification

**Version:** 2.0 (Production Verified Baseline)  
**Status:** All 11 Work Packages Completed & Production Verified (`wp11-done`)

---

## 1. Executive Summary

Lumina PMS is an original, production-grade, AI-powered hospitality property management system designed for independent boutique hotels, resorts, guesthouses, serviced apartments, and vacation rental management companies.

Lumina combines an operational core — multi-tenancy, property hierarchies, atomic room night inventory with strict double-booking prevention, rate plans with seasonal modifiers, decimal financial arithmetic, front desk workspaces, housekeeping turnover, and maintenance work orders — with an autonomous AI operations agent, human-in-the-loop supervisor approvals, anti-IDOR customer portal, PostgreSQL full-text search knowledge base, and an integrations framework with RFC 5545 iCalendar synchronization and idempotent webhook processing.

---

## 2. Verified Architectural Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 Browser Layer (Next.js 15 App Router)                   │
│   Operations Hub · Front Desk · Tape Chart · Guest Portal · AI Console │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS / JSON / Cookies
┌────────────────────────────────────▼────────────────────────────────────┐
│                    Next.js 15 Authorized Service Layer                  │
│    Route Handlers · Server Actions · Zod Validation · Rate Limiter      │
│    Tenant Isolation (`organizationId`) · Strict RBAC Permission Matrix │
└───────┬────────────────────┬───────────────────┬────────────────────────┘
        │                    │                   │
        ▼                    ▼                   ▼
┌───────────────┐   ┌─────────────────┐   ┌───────────────────────────────┐
│  PostgreSQL   │   │  ACID Delivery  │   │  Provider-Agnostic AI Hub     │
│  (Prisma ORM) │   │  Queue Engine   │   │  (OpenAI, Gemini, Anthropic,  │
│  + Native FTS │   │  (Transactional │   │   Groq & Mock Adapters)       │
│  + RoomNights │   │   Outbox)       │   │  + Human Supervisory Gate     │
└───────────────┘   └────────┬────────┘   └──────────────┬────────────────┘
                             │                           │
                             ▼                           ▼
                      Worker Runner              Tool Registry
                   (Branded Templates,         (16 Operations Tools,
                    Automated Reminders,        Risk Classifications,
                    Retention Purges)           Supervisor Approvals)
```

---

## 3. Work Package Implementation Matrix

| Work Package | Focus Area | Verification Gate | Status |
| --- | --- | --- | --- |
| **WP0** | Foundations, Environment & Docker Setup | `tests/auth-login.test.ts` (2 tests) | Completed (`wp0-done`) |
| **WP1** | Schema v2, RoomNight Uniqueness & Constraints | `tests/schema-v2.test.ts` (4 tests) | Completed (`wp1-done`) |
| **WP2** | Auth, Session Resolution, RBAC & Multi-Tenancy | `tests/auth-rbac-tenancy.test.ts` (6 tests) | Completed (`wp2-done`) |
| **WP3** | Properties, Rooms, Rate Plans & Decimal Pricing | `tests/pricing-and-properties.test.ts` (12 tests) | Completed (`wp3-done`) |
| **WP4** | Reservations Engine, Concurrency & State Machine | `tests/reservations.test.ts` (9 tests) | Completed (`wp4-done`) |
| **WP5** | Front Desk, Housekeeping & Maintenance Workspaces | `tests/frontdesk-housekeeping-maintenance.test.ts` (7 tests) | Completed (`wp5-done`) |
| **WP6** | Server-Side Billing, Invoices & Reconciled Payments | `tests/billing-and-payments.test.ts` (6 tests) | Completed (`wp6-done`) |
| **WP7** | Transactional Notifications Queue & Branded Email | `tests/notifications.test.ts` (6 tests) | Completed (`wp7-done`) |
| **WP8** | AI Operations Hub, Tool Dispatch & Approvals | `tests/ai-hub-and-agent.test.ts` (9 tests) | Completed (`wp8-done`) |
| **WP9** | Customer Portal, Anti-IDOR Verification & Chatbot | `tests/customer-portal-and-chatbot.test.ts` (13 tests) | Completed (`wp9-done`) |
| **WP10** | Reports, ADR/RevPAR Analytics, iCal & Hardening | `tests/reports-integrations-hardening.test.ts` (9 tests) | Completed (`wp10-done`) |
| **WP11** | UX Polish, Omnisearch, Playwright Journeys & Docker | `e2e/journeys.spec.ts` (3 E2E journeys) | Completed (`wp11-done`) |

---

## 4. Key Architectural Guarantees

1. **Zero Double-Bookings:** Physical inventory is locked by atomic `RoomNight` records bound by database unique constraint `@@unique([roomId, date])`.
2. **Strict Financial Precision:** All currency amounts (rates, taxes, discounts, totals, balances) utilize `Decimal(12, 2)` arithmetic; zero floating-point math for money.
3. **Multi-Tenant Isolation:** Every data entity and query enforces explicit `organizationId` scoping, verified via automated cross-tenant security tests.
4. **Anti-IDOR Public Customer Portal:** Guest bookings cannot be accessed with confirmation references alone; requires verified email matching.
5. **AI Human-in-the-Loop Governance:** High-risk actions (`cancel_reservation`, `refund_payment`, `create_reservation`, `bulk_send_messages`) pause execution for supervisor approval.
6. **Universal Activity Logging:** Captures both frontend UI events and backend operations with user context, timestamps, PII redaction, and human-readable summaries.
7. **Production Standalone Packaging:** Next.js `output: "standalone"` multi-stage Docker container with non-root security execution.

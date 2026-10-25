# SUPERVISION_PLAN.md

## Instructions for the implementing AI (read first)
- You implement; a separate reviewer (Claude) audits each work package (WP) before you move on. Do **one WP at a time**, in order, starting at WP0.
- Do not skip ahead or mark a WP done until its gate passes. Do not weaken or delete tests to get green.
- After each WP: commit (`git commit`, tag `wpN-done`), then report: files changed, commands run, and the **real, unedited output** of `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, plus the WP-specific gate.
- Never claim a feature works that you did not run. Update `PROGRESS.md` only with verified facts and known limitations.
- Every DB query on tenant data must be scoped by organization (and property where applicable). Every route body must be parsed by zod. No money in floats. No secrets in the repo, logs, or client bundle.
- Preserve working code where sound; the audit findings below say what is broken.
- If a requirement is ambiguous or a gate cannot be met, stop and report instead of working around it.

---

# Lumina PMS — Audit & Supervised Build Plan

## Context
`C:\Users\DELL\Downloads\pms` holds a partial scaffold ("Lumina PMS": Next 15, React 19, Prisma, jose, hand-rolled UI). The user wants the full hospitality PMS spec delivered. **Another AI writes the code; I (Claude) audit and supervise.** This plan is the contract: ordered work packages (WPs), each with acceptance gates I verify by running commands and reading diffs before the next WP starts.

## Audit verdict (static; nothing was run)
**Not runnable today.** `next build` fails type-check (`app/(app)/calendar/page.tsx:58`), and auth is broken: `lib/auth/session.ts:72-74` imports non-existent `verify` from `jose` (swallowed by try/catch → every session null → all APIs 401, all pages redirect to /login). `session.ts` also reads non-existent `membership.permissions`, `organizationMember`, `isAdmin`. `lib/ai/providers.ts:82-85` uses undeclared `tools`.

**Keep (useful):** Next/Tailwind/TS setup, zod + bcryptjs(12) + jose choice, `lib/permissions.ts` concept, AES-256-GCM in `lib/ai/encryption.ts` (correct core), provider adapter idea, route layout, Decimal money intent, page shells, seed idea, doc skeletons.

**Fix/replace:**
- DB: SQLite + `relationMode=prisma`, no enums, no indexes, no migrations, no FK relations on many org fields. Spec & docker say PostgreSQL → **move to PostgreSQL**; real FKs, enums, indexes, migrations. Decimal on SQLite is float — unacceptable for money.
- Missing models: Permission table, GuestProfile, tenant `organizationId` on Room/RoomType/RatePlan/HousekeepingTask/MaintenanceTicket/Refund/InvoiceLineItem/GuestRequest, encrypted integration credentials, KB chunks/tsvector (+pgvector optional), night-level inventory table for double-booking protection.
- Security holes: IDOR PATCH in properties/[id], invoices/[id], maintenance/[id]; payments invoiceId unchecked; rooms/housekeeping POST foreign ids; AI tools cross-tenant (`lib/ai/tools.ts:175,194,203`); `/reports` uses `organizations[0]` (leaks data); open register mints bogus `permissions:["admin"]`; reset token via `Math.random`, plaintext, never emailed; default dev secrets/zero key not blocked in prod (`lib/env.ts`); SSRF + key exfil via user `baseUrl` (`providers.ts:92`); seed wipes DB with known password; no zod on routes (mass assignment, raw error echo); no rate limiting, middleware, headers; `propertyIds` never enforced.
- AI agent: approval flag bug (`requiresApproval` function always truthy), no schema validation per tool, no reject path, approver permission not rechecked, no resume, fallback/usage tracking absent, Gemini/Anthropic tool translation wrong.
- Business logic: overlap check only first conflict; PATCH reservation no re-check/transitions; no pricing (RatePlan unused); payments mark paid without amount reconciliation; no refunds; check-in without balance policy.
- Not built: public booking, guest portal, chatbot widget (respond endpoint is staff-only, "RAG" = last 5 docs), notifications/email queue, rates UI, room-type CRUD (`/rooms` calls missing `/api/roomtypes`), settings (stub), reports/export, audit viewer, webhooks, online check-in, Playwright.
- Docs: README/PROGRESS overstate; Dockerfile broken (no `public/`, no prisma generate); missing deps (clsx, cva, radix). Tests: 8 trivial cases, none for auth/tenancy/availability.

## Supervision protocol (applies to every WP)
1. Implementer works one WP at a time in a git repo (WP0 runs `git init`; one commit per WP, tag `wpN-done`).
2. Implementer posts: files changed, commands run, test output.
3. I independently run: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, plus WP-specific checks, and grep-review diffs against the red-flag list (below). WP is accepted only if all pass; else I return a defect list.
4. `PROGRESS.md` updated only with verified facts (tests passing counts, known limits).

**Standing red flags I grep for each time:** Prisma queries on org-owned tables without `organizationId` (or property scope); `request.json()` not parsed by zod; `Number(` on money; `organizationId ?? ""`; secrets/keys in responses/logs/client bundle; `NEXT_PUBLIC_` secrets; claiming success before backend confirm; hardcoded demo data outside seed; buttons without handlers.

## Work packages (ordered)

**WP0 – Stabilise & foundation.** git init; fix `jwtVerify`/session; Postgres via docker-compose; typecheck/lint/test/build green; add `typecheck` script; install missing deps (clsx, cva, radix, playwright, tailwind-animate as needed); fail-fast `lib/env.ts` (zod; production refuses defaults/short keys); remove seed-in-prod risk (guard + env password). *Gate:* clean `docker compose up db`, `npm run build` passes, login works.

**WP1 – Schema v2 + migrations.** Rewrite `prisma/schema.prisma` for Postgres: enums for all statuses, real relations, `organizationId` on every tenant table, indexes on FKs/status/dates, Permission + Role + RolePermission, GuestProfile, `Money` as `Decimal(12,2)` (or int minor units), `RoomNight(roomId,date)` unique table (or `btree_gist` exclusion constraint via raw migration) for double-booking protection, KB `tsvector` + GIN index, encrypted credential table shared by AI & integrations (key version column), hashed reset tokens, idempotency keys table. Create initial migration; idempotent dev-only seed with generated demo creds. *Gate:* `prisma migrate reset` works from clean; all 35 spec models present (checklist in PR).

**WP2 – Auth, RBAC, tenancy.** Central `getAuthContext()`; `requirePermission(perm, {propertyId})` enforcing org AND property scope; permission/role sync from `lib/permissions.ts`; a tenant-scoped data-access layer (every repo fn takes ctx) used by ALL routes; middleware for pages; secure register (org bootstrap only), crypto-random hashed reset tokens + email via notification service, login/reset rate limits, CSRF origin check, security headers, audit logging helper. Customer role/portal accounts distinct from staff. Fix every IDOR listed above. *Gate:* tests — registration/login, role matrix, org A cannot read/write org B on every route (table-driven test iterating all routes), property-scope test, rate-limit test.

**WP3 – Properties, rooms, room types, rates.** Room-type CRUD (fix missing `/api/roomtypes`), amenities, settings page real (tz, currency, tax, check-in/out times), setup wizard + onboarding, rate plans/seasonal/discounts/coupons/fees, pricing engine in integer/Decimal math. *Gate:* unit tests for pricing/tax rounding; wizard e2e.

**WP4 – Reservations engine.** Transactional create/modify/extend/cancel using RoomNight unique inserts (+ `SERIALIZABLE`/advisory lock); multi-room/group; statuses state machine; cancellation policy + fees; booking codes; idempotency keys; fix search (`guest` relation, Postgres `mode`). *Gate:* concurrency test (parallel N creates of same room/night → exactly 1 succeeds), overlap edge cases (back-to-back stays OK), transition tests.

**WP5 – Front desk, housekeeping, maintenance.** Front-desk workspace, check-in/out (balance + ID verification rules), auto housekeeping task on checkout, room-status transitions, maintenance blocks removing availability, comments/activity history, attachments via secure upload (type/size/random name, outside web root), notifications on status change. Calendar page fixed with drag-drop reassignment.

**WP6 – Billing.** Invoice generated server-side from reservation (never trust client totals), line items, deposits/partial payments, balance, refunds workflow + approval, printable invoice/receipt, payment-gateway adapter interface (Stripe first) with webhook signature verification; "paid" only from verified gateway event or recorded manual payment with amount reconciliation. *Gate:* invoice math tests, payment status tests, webhook signature tests (mock gateway, clearly labelled).

**WP7 – Notifications.** Queue (pg-boss or BullMQ+Redis), templates with property branding, delivery log, preferences, provider-configurable email (SMTP/Resend), reminders (pre-arrival, check-in, checkout, payment).

**WP8 – AI hub + agent.** Provider adapter interface (OpenAI, Gemini, Groq, Anthropic) with correct tool-call translation, fallback chain, timeouts, token limits, error taxonomy, usage/latency/cost tracking; per-feature config (agent vs chatbot) and independent disable switches; SSRF-safe `baseUrl` (allowlist/HTTPS/no private IPs; never send key to custom hosts unless admin-approved); key rotation versioning; masked UI. Agent: zod schema per tool (provider-neutral registry), `risk: read|reversible|sensitive`, per-tool permission + property scope, policy-driven approval, approve/reject/resume, idempotency, verify-then-report, retry limits, Activity Center page with PII redaction. All tools call the same service layer as the REST API. *Gate:* tests — tool permission denial, cross-tenant denial, approval required for refund/cancel/bulk send, rejection path, injected-prompt data cannot escalate, AI disabled → app still works.

**WP9 – Customer portal & chatbot.** Public search/booking (optional account), My Bookings, profile, cancellation request, messages, online check-in. Chatbot: public widget + embeddable script, KB manager, Postgres FTS retrieval (pgvector optional later), grounding prompt, tools (availability, rates, create ticket, handoff), identity verification (booking ref + email OTP / logged-in account — never ref alone), operating hours, human handoff, test-chat, retention. *Gate:* retrieval test, verification test (ref alone denied; other customer's data never returned), multi-tenant KB isolation.

**WP10 – Reports, dashboard, integrations, hardening.** Dashboard/reports from real queries scoped to ctx (occupancy, ADR = room revenue/rooms sold, RevPAR = room revenue/rooms available, outstanding, cancellations/no-shows, CSV export); audit-log viewer; integrations framework (status, encrypted creds, sync logs, webhook receiver with signature + dedupe by external id; adapters stubbed and labelled "not connected"); data export/deletion, retention jobs; backup docs.

**WP11 – UX polish & delivery.** Global search, quick-create, collapsible sidebar, customizable widgets, empty states, toasts, confirm dialogs, a11y pass, mobile layouts, Playwright journeys (admin setup → booking → check-in → invoice; customer booking; AI approval), Dockerfile fix (standalone output, prisma generate, `public/`), README/PROJECT_PLAN/PROGRESS rewritten truthfully, `.env.example` complete.

## Verification (final)
Clean clone → `docker compose up -d db && npm ci && npx prisma migrate deploy && npm run db:seed && npm run build && npm test && npx playwright test` all green; manual smoke of Definition-of-Done checklist (spec §17) as admin, staff, customer; security grep list returns clean; no secrets in repo/bundle.

## Decisions taken (flag if you disagree)
- Switch DB to **PostgreSQL** per spec (SQLite cannot give money precision or overlap guarantees).
- Keep custom jose/bcrypt auth (fixed) rather than adopting Auth.js, to avoid churn; reconsider only if OAuth/SSO is needed.
- Preserve existing page shells and component names where sound; replace hand-rolled `components/ui` with real shadcn/Radix incrementally.

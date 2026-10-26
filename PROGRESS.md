# Lumina PMS — Progress

## Current status

- **Phase:** WP8 – AI Operations Hub, Provider Adapters, Tool Dispatch, Human-in-the-Loop Approvals & Universal Activity Logging (Completed and Verified).
- **Overall completion:** ~92%

## Completed

### WP0 – Stabilise & foundation
- [x] Initialized Git repository (`git init`).
- [x] Added `typecheck` script (`tsc --noEmit`) to `package.json`.
- [x] Installed missing dependencies: `clsx`, `class-variance-authority`, `@radix-ui/react-slot`, `tailwindcss-animate`, `@playwright/test`, `embedded-postgres`.
- [x] Fixed `jose` session & JWT verification (`lib/auth/jwt.ts`, `lib/auth/session.ts`) eliminating `verify` import error.
- [x] Configured native PostgreSQL support via `scripts/db.mjs` and `npm run db:start` on port 5432.
- [x] Implemented fail-fast Zod validation in `lib/env.ts` (enforces 32+ character secrets, rejects insecure defaults and zero keys in production runtime).
- [x] Hardened `prisma/seed.ts` against accidental production execution with explicit safety guards and configurable admin password.
- [x] Resolved React Server Component directives by adding missing `"use client"` in `login`, `register`, `forgot-password`, and `reset-password`.
- [x] Resolved all TypeScript compiler errors across components, API routes, and agent utilities.
- [x] Resolved ESLint build-blocking errors across all pages and API routes.
- [x] Verified complete login and session resolution pipeline (`tests/auth-login.test.ts`).

### WP1 – Schema v2 + migrations
- [x] Fully rewritten `prisma/schema.prisma` for PostgreSQL with 45 models and 18 status enums.
- [x] Configured native foreign key relations and referential integrity across all models.
- [x] Added `organizationId` scoping to all tenant-owned models (Room, RoomType, RatePlan, HousekeepingTask, MaintenanceTicket, Refund, InvoiceLineItem, GuestRequest, etc.).
- [x] Implemented indexes across foreign keys, status enums, and timestamp/date fields.
- [x] Implemented comprehensive RBAC models (`Permission`, `Role`, `RolePermission`).
- [x] Implemented `GuestProfile` model linked to `Guest` (and optional `User`) for loyalty, stay stats, and preferences.
- [x] Implemented financial precision with `@db.Decimal(12, 2)` across all monetary fields.
- [x] Created `RoomNight` model with unique constraint `@@unique([roomId, date])` for strict schema-level double-booking protection.
- [x] Added PostgreSQL Full-Text Search GIN indexes on `KnowledgeBaseDocument` and `KnowledgeBaseChunk` using `to_tsvector`.
- [x] Implemented `EncryptedCredential` shared credential storage for AI and integrations with `keyVersion` column.
- [x] Implemented `IdempotencyKey` table with expiration tracking for safe mutation retries.
- [x] Created initial baseline migration (`prisma/migrations/20261025162411_init/migration.sql`) including GIN indexes.
- [x] Authored comprehensive, idempotent dev-only seed script (`prisma/seed.ts`) populating Permissions, Roles, Admin User, Organization, Property, RoomTypes, Rooms, RatePlan, Guest, GuestProfile, Reservation, RoomNights, Invoice, Payment, HousekeepingTask, KnowledgeBase, and EncryptedCredential.
- [x] Connected `prisma.seed` in `package.json` ensuring automated seeding on `prisma migrate reset`.
- [x] Added automated gate tests (`tests/schema-v2.test.ts`) validating 45 spec models, unique constraint violation code `P2002` on duplicate `RoomNight`, `GuestProfile`, `EncryptedCredential`, `IdempotencyKey`, and PostgreSQL FTS queries.

### WP2 – Auth, RBAC, tenancy
- [x] Central `getAuthContext(request?)` resolving `SessionUser`, `organizationId`, `propertyIds`, `isOrgAdmin`, `isCustomer`, `hasPermission()`, and `hasPropertyAccess()`.
- [x] Granular `requirePermission(perm, { propertyId, request })` and `requireAuthContext(request?)` enforcing org scope and property scope (returning 401 for unauthorized, 403 for forbidden).
- [x] Dynamic permissions and role sync (`lib/permissions.ts`), distinguishing `customer` role with guest-portal boundaries from internal staff/manager roles.
- [x] Tenant-scoped Data Access Layer (`lib/dal.ts`) enforcing `organizationId` filtering and cross-tenant foreign ID ownership validation (`CrossTenantViolationError`).
- [x] Complete security middleware (`middleware.ts`) enforcing CSRF origin verification on mutating requests, strict security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), and unauthenticated path routing.
- [x] Secure registration route (`/api/auth/register`) with Zod schema validation, bcrypt(12) hashing, and automatic organization bootstrap with Owner/Admin role binding.
- [x] Cryptographic password reset lifecycle (`lib/auth/passwords.ts`, `/api/auth/forgot-password`, `/api/auth/reset-password`) using SHA-256 token hashing at rest, 1-hour expiration, and simulated notification dispatch.
- [x] Sliding-window rate limiting on auth endpoints (`lib/rate-limit.ts`).
- [x] Remediated all audit IDORs: `/api/properties/[id]`, `/api/rooms`, `/api/housekeeping`, `/api/maintenance`, `/api/maintenance/[id]`, `/api/invoices`, `/api/invoices/[id]`, `/api/payments`, `/app/(app)/reports` (eliminated `organizations[0]` leakage), AI tools in `lib/ai/tools.ts`, and SSRF safe URL guard in `lib/ai/providers.ts`.
- [x] High-converting, comprehensive landing page at `app/page.tsx` with Hospitable.com branding (Hospitable Grape `#6D28D9` / `#7C3AED` on obsidian `#090D16`), zero emojis, thin-line Lucide icons, unified command center simulator, partner ecosystem badges, 5-tab feature showcase, interactive ROI calculator, verified host reviews, transparent pricing matrix, and FAQ accordion.
- [x] Automated WP2 gate test suite (`tests/auth-rbac-tenancy.test.ts`) validating Registration & Login bootstrap, RBAC matrix, Cross-tenant DAL isolation, Property-scope boundaries, Rate limiting, and Crypto-hashed password reset lifecycles.

### WP3 – Properties, rooms, room types, rates
- [x] Built missing room-type CRUD routes (`/api/roomtypes`, `/api/roomtypes/[id]`) with strict tenant scoping and property ownership checks.
- [x] Built rate plans API (`/api/rate-plans`, `/api/rate-plans/[id]`) with seasonal rate windows (`/api/rate-plans/[id]/seasons`).
- [x] Built discounts & coupons API (`/api/discounts`) supporting percentage and fixed discounts, redemption limits, and date validity.
- [x] Built amenities API (`/api/amenities`) with room assignment (`assign` / `unassign`).
- [x] Designed and implemented high-precision Decimal Pricing Engine (`lib/pricing/engine.ts`) with half-up rounding, multi-season splits, extra-guest surcharges, coupons, tax calculation, and leap-year/date boundaries.
- [x] Built real-time pricing quote calculation API (`/api/pricing/quote`).
- [x] Real property & operations Settings page (`app/(app)/settings/page.tsx`) managing timezone, currency, check-in/out hours, tax rates, cleaning fees, and contact details.
- [x] Step-by-step Setup Wizard & Onboarding page (`app/(app)/onboarding/page.tsx`) with atomic backend provisioning (`/api/setup-wizard` via `dal.onboarding.setupProperty`).
- [x] Enhanced Rooms & Room Types operational interface (`app/(app)/rooms/page.tsx`) with room category management and property filtering.
- [x] Automated WP3 gate test suite (`tests/pricing-and-properties.test.ts`): 12 comprehensive unit and integration tests for Decimal pricing, tax rounding, season splits, discount bounds, date validations, room-type CRUD, rate plans, and atomic setup wizard.

### WP4 – Reservations engine & double-booking prevention
- [x] High-entropy crypto booking code generation (`BK-XXXXXX`) using `crypto.randomBytes`.
- [x] Transactional `createReservation` inserting individual `RoomNight(roomId, date)` rows alongside reservation headers and room relations.
- [x] Concurrency gate: hardware-grade ACID concurrency protection via PostgreSQL `@@unique([roomId, date])`. 8 parallel concurrent requests for the exact same room and dates result in exactly 1 commit and 7 clean `DoubleBookingConflictError` (HTTP 409) rejections.
- [x] Overlap edge cases: back-to-back stays succeed without collisions (checkout morning = checkin afternoon); interior overlaps fail.
- [x] Multi-room / group bookings allocate rooms and nights atomically across all selected rooms.
- [x] State machine transition enforcement (`draft` -> `pending` -> `confirmed` -> `checked_in` -> `checked_out`), strictly rejecting invalid jumps (`checked_out` -> `confirmed`, `cancelled` -> `checked_in`).
- [x] Cancellation lifecycle: immediate release of `RoomNight` inventory rows, automatic late-cancellation fee calculation for cancellations within 24 hours of check-in (`/api/reservations/[id]/cancel`).
- [x] Reservation modification and extension: dynamic diffing of night intervals, releasing unneeded nights and allocating new ones with transactional rollback on conflict.
- [x] Case-insensitive search across booking `code`, `guest.firstName`, `guest.lastName`, and `guest.email` strictly scoped to tenant.
- [x] Idempotency key gate: `Idempotency-Key` header cached in `IdempotencyKey` table with expiration and instant replay of 201 responses.
- [x] Automated WP4 gate test suite (`tests/reservations.test.ts`): 9 comprehensive gate tests verifying concurrency, edge cases, multi-room, state machine, cancellation, modification, search, and idempotency.

### WP5 – Front desk, housekeeping, and maintenance workspaces
- [x] Front Desk workspace (`app/(app)/frontdesk/page.tsx`): live KPI stats (arrivals, departures, occupancy rate, room readiness, outstanding balances), interactive check-in modal enforcing ID verification & balance policy with manager override, checkout modal with auto turnover cleaning dispatch, room rack with quick status management.
- [x] Check-in rules (`/api/reservations/[id]/check-in` & `lib/operations.ts`): enforces ID verification (`IdVerificationRequiredError`), room cleanliness (`RoomNotReadyError` - room must be clean/inspected), and financial balance (`OutstandingBalanceError`).
- [x] Checkout lifecycle (`/api/reservations/[id]/check-out`): transitions reservation to `checked_out`, room status to `dirty`, and automatically dispatches turnover `HousekeepingTask` with `high` priority and 3-hour due window.
- [x] Housekeeping workspace (`app/(app)/housekeeping/page.tsx`, `/api/housekeeping/[id]`, `/api/housekeeping/[id]/comments`): cleaning task queue, status progression (`pending` -> `in_progress` -> `completed`), auto room transition (`dirty` -> `clean` on task completion), comments and photo attachment support.
- [x] Maintenance workspace (`app/(app)/maintenance/page.tsx`, `/api/maintenance`, `/api/maintenance/[id]`): work order management, inventory block engine (creates `RoomNight` records with `status: "maintenance"`, moves room to `out_of_service`, blocks reservation attempts with `DoubleBookingConflictError`, and automatically releases blocks and restores room status on resolve).
- [x] Room reassignment & move engine (`/api/reservations/[id]/reassign-room`): transfers remaining stay nights atomically, updates room statuses, and creates turnover task for vacated room.
- [x] Interactive tape chart & calendar (`app/(app)/calendar/page.tsx`): 7/14 day room matrix with HTML5 drag-and-drop room reassignment.
- [x] Secure uploads & attachments (`/api/uploads`, `/api/uploads/[filename]`, `lib/uploads.ts`): file size limit (<= 10MB), MIME whitelist validation, cryptographically random UUID filename generation, saved strictly outside web root (`storage/uploads`), secure streaming download.
- [x] Activity history & notifications: `AuditLog` records for all operational transitions, and `Notification` events on status change (`reservation_checked_in`, `reservation_checked_out`, `housekeeping_task_completed`, `maintenance_urgent_ticket`).
- [x] Shared error definitions (`lib/errors.ts`) preventing circular imports and ensuring cross-module `instanceof` fidelity.
- [x] Automated WP5 gate test suite (`tests/frontdesk-housekeeping-maintenance.test.ts`): 7 comprehensive tests verifying check-in rules, checkout auto-housekeeping, cleaning completion room transitions, maintenance blocks, room moves, secure uploads, and tenant isolation.

### WP6 – Billing, server-side invoice calculations, payments & gateway integration
- [x] Server-side invoice generation (`/api/invoices/generate`, `lib/billing.ts`): never trusts client totals, computes itemized room nights, cleaning fees, and taxes with exact `Decimal(12, 2)` arithmetic; generates sequential invoice numbers (`INV-YYYYMM-XXXX`); enforces idempotency.
- [x] Deposits & partial payments tracking (`/api/invoices/[id]/payments`, `lib/billing.ts`): calculates net captured payments minus refunds and real-time balance due; transitions status to `partially_paid` when partial payments are received.
- [x] Reconciled payment completion & "paid" rule: transitions invoice to `paid` status ONLY when remaining balance reaches zero; eliminates arbitrary client overrides (rejects manual `PATCH /api/invoices/[id]` status changes to `paid`/`partially_paid`/`refunded`); rejects overpayments and payments on settled folios.
- [x] Refunds workflow & manager approval lifecycle (`/api/payments/[id]/refund`, `/api/refunds/[id]/approve`): staff requests refund with reason (`status: "pending"`), checks refundable limits against payment amount, manager approves refund (`status: "succeeded"`), transitions payment to `partially_refunded` or `refunded`, and automatically recalculates invoice status and balance.
- [x] Payment Gateway Adapter Interface (`lib/payments/gateway.ts`): clean `PaymentGatewayAdapter` interface with `StripeGatewayAdapter` and clearly labelled `MockGatewayAdapter` for development and testing.
- [x] Cryptographic Webhook Signature Verification (`/api/webhooks/payments`): verifies Stripe HMAC-SHA256 signatures (`t=...,v1=...`), enforces 15-minute tolerance window to prevent replay attacks, timing-safe equality checks, and reconciles invoice balances upon verified events.
- [x] Printable Guest Folio & Receipt page (`app/(app)/billing/[id]/page.tsx`, `/api/invoices/[id]/receipt`): dedicated receipt view with property branding, guest details, room night line items, payment history, balance due, and print-ready CSS (`window.print()`).
- [x] Enhanced Billing Workspace (`app/(app)/billing/page.tsx`): live revenue KPIs (Open Balance, Collected Revenue, Total Invoiced, Overdue Count), status filters, search, "Generate from Reservation" modal, and reconciled payment modal.
- [x] Automated WP6 gate test suite (`tests/billing-and-payments.test.ts`): 6 comprehensive unit and integration tests verifying server-side line item math, deposit balance tracking, reconciled payment completion, refunds lifecycle, webhook signature verification, and multi-tenant isolation.

### WP7 – Notifications, branded templates, delivery logs, preferences & reminders
- [x] Transactional Notification Queue Engine (`lib/notifications/queue.ts`, `lib/dal.ts`): ACID-backed PostgreSQL queue, idempotency, claiming, worker processor (`dal.notifications.processQueue`), and exponential backoff retry counter (`2^attempts * 1000ms`).
- [x] Property-Branded HTML Email Templates (`lib/notifications/templates.ts`, `/api/notifications/preview`): 5 hospitality templates (`pre_arrival`, `check_in_welcome`, `check_out_thanks`, `payment_receipt`, `payment_reminder`) with dynamic property branding (name, address, phone, email, brand colors, styled action buttons).
- [x] Configurable Provider Adapters (`lib/notifications/providers.ts`): pluggable `EmailProviderAdapter` interface with `MockEmailAdapter` (simulated failures, sent history inspection), `ResendEmailAdapter` (production HTTP API), and `SmtpEmailAdapter`.
- [x] Recipient Privacy & Preferences Gate (`lib/notifications/preferences.ts`, `/api/notifications/preferences`): guest profile preferences (`emailEnabled`, `smsEnabled`, `preArrivalReminders`, `checkInReminders`, `checkOutReminders`, `paymentReminders`, `marketingEmails`), enforcing opt-out suppression at enqueue time without persisting unwanted jobs.
- [x] Automated Guest Reminders Engine (`lib/notifications/reminders.ts`, `/api/notifications/reminders`): time-window scanning (pre-arrival 24h-72h, check-in welcome, post-checkout thanks, overdue payment reminders) with strict deduplication preventing duplicate communications.
- [x] Delivery Audit Logs (`lib/notifications/queue.ts`, `/api/notifications/logs`): detailed provider delivery attempt records (provider, providerRef, status, latency ms, timestamp, error).
- [x] Notifications Operational Workspace (`app/(app)/notifications/page.tsx`): live KPI stats (in queue, delivered, failed, suppressed), tabbed view (dispatch queue vs delivery audit logs), manual queue trigger, reminders runner, manual notification enqueue modal, and interactive live template preview modal with property branding.
- [x] Dynamic route retry endpoint (`/api/notifications/[id]/retry`) for re-queuing failed delivery attempts.
- [x] Automated WP7 gate test suite (`tests/notifications.test.ts`): 6 comprehensive unit and integration tests verifying queue lifecycle, exponential backoff retries, branded template interpolation across all 5 templates, recipient preferences & opt-out suppression, automated reminders with deduplication, and strict multi-tenant isolation.

### WP8 – AI operations hub, provider adapters, tool dispatch & human-in-the-loop approvals
- [x] Provider-Agnostic Adapter Engine (`lib/ai/providers.ts`): normalized interface supporting OpenAI, Google Gemini, Groq, Anthropic Claude, and Mock adapters with tool-call formatting, system prompts, AbortSignal timeouts, and token limits.
- [x] Resilient Provider Error Taxonomy (`lib/ai/providers.ts`): structured hierarchy with `AiProviderError`, `AiRateLimitError`, `AiTimeoutError`, `AiAuthenticationError`, and `AiDisabledError`.
- [x] Automatic Fallback Chain: primary provider rate limit, timeout, or 5xx automatically triggers fallback provider with audit event recording.
- [x] Token Estimation & Usage Tracking: computes prompt/completion token usage, execution latency in milliseconds, and estimated cost in USD based on standard provider pricing rates.
- [x] Comprehensive SSRF Protection (`assertSafeBaseUrl`): validates HTTPS, strictly blocks cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`, `metadata.azure.com`), and restricts private/loopback IP ranges in production.
- [x] Provider-Neutral Tool Registry with Zod Schemas (`lib/ai/tools.ts`): 16 operational tools with strict Zod validation and risk classifications:
  - `read`: `search_reservations`, `check_availability`, `get_guest_summary`, `get_invoices`, `generate_report`, `get_policies`.
  - `reversible`: `update_room_status`, `create_housekeeping_task`, `create_maintenance_ticket`, `check_in_reservation`, `check_out_reservation`, `draft_message`.
  - `sensitive` (**Mandatory Approval**): `create_reservation`, `cancel_reservation`, `refund_payment`, `bulk_send_messages`.
- [x] Autonomous Agent Loop (`lib/ai/agent.ts`): multi-turn agent coordinator (up to 5 turns), enforcing tenant scoping, user RBAC permissions, and property restrictions.
- [x] Human-in-the-Loop Supervisory Approval Workflow: sensitive tools automatically pause execution, persist `ApprovalRequest` and `AiToolExecution` records with status `pending`, set `AiAgentExecution` to `awaiting_approval`, and return clean approval pending outcome without running the tool prematurely.
- [x] Dedicated Approval Resolution Paths: `approveAiExecution` re-validates approver's `ai.approve` permission, executes the underlying tool with supervisor authority, marks `ApprovalRequest` as `executed`, and updates agent execution to `completed`. `rejectAiExecution` marks request `rejected`, marks tool execution `rejected`, terminates agent execution with `failed`, and preserves existing reservation/payment state untouched.
- [x] Prompt Injection Defense: malicious user prompts attempting to override policies or bypass approvals are safely handled; tool dispatch and RBAC checks are strictly governed by TypeScript code.
- [x] Independent Disable Switches: toggling `isEnabled: false` halts the AI agent gracefully with `AiDisabledError` while core PMS functions continue to operate completely unaffected.
- [x] Universal Dual-Source Activity Logging Engine (`lib/audit.ts`, `app/api/activity-logs`, `components/activity-tracker.tsx`, `lib/client-logger.ts`): logs frontend user actions (navigation, button clicks, errors) and backend events (auth, reservations, frontdesk, billing, housekeeping, maintenance, notifications, AI) with precise ISO timestamp, user details (`userId`, `userName`, `userEmail`, `userRole`), IP address, user agent, PII redaction, and human-readable summary.
- [x] Activity Logs Operational Viewer (`app/(app)/activity-logs/page.tsx`): live stream viewer with Frontend vs Backend source badges, KPI summary counters, category filters, text search, and JSON metadata inspector modal.
- [x] AI Operations Hub Workspace (`app/(app)/ai/page.tsx`): interactive conversational operations console, quick action prompt chips, pending supervisor approvals review card with 1-click Approve and Confirm Reject buttons, and live execution audit stream.
- [x] AI Provider Hub Workspace (`app/(app)/ai/providers/page.tsx`): encrypted provider configuration, AES-256-GCM key storage, masked key hints (`•••• 4821`), default toggles, connection testing, and deletion.
- [x] Automated WP8 gate test suite (`tests/ai-hub-and-agent.test.ts`): 9 comprehensive unit and integration tests verifying tool permission denial, cross-tenant isolation, sensitive tool approval gating, approval resolution path, rejection resolution path, prompt injection defense, AI disabled switch resilience, universal activity logging integration, and SSRF base URL protection.

## In progress

- WP9 – Customer portal & chatbot.

## Pending

- WP9: Customer portal & chatbot.
- WP10: Reports, dashboard, integrations, hardening.
- WP11: UX polish, Playwright journeys, production build & delivery.
